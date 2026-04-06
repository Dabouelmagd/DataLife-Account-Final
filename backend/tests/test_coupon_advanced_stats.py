"""
Test Coupon Advanced Statistics and Email Sending Features
- GET /api/coupons/statistics/advanced - returns summary, top coupons, monthly report, type distribution, email stats
- POST /api/coupons/send-email - sends real email via SMTP
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCouponAdvancedStatistics:
    """Test advanced coupon statistics endpoint"""
    
    def test_advanced_statistics_endpoint_returns_200(self):
        """Test that advanced statistics endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/coupons/statistics/advanced")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Advanced statistics endpoint returns 200")
    
    def test_advanced_statistics_has_summary(self):
        """Test that response contains summary with required fields"""
        response = requests.get(f"{BASE_URL}/api/coupons/statistics/advanced")
        assert response.status_code == 200
        data = response.json()
        
        # Check summary exists
        assert "summary" in data, "Response missing 'summary' field"
        summary = data["summary"]
        
        # Check required summary fields
        required_fields = ["total_coupons", "active_coupons", "expired_coupons", "total_usage", "total_discounted_amount"]
        for field in required_fields:
            assert field in summary, f"Summary missing '{field}' field"
        
        # Validate types
        assert isinstance(summary["total_coupons"], int), "total_coupons should be int"
        assert isinstance(summary["active_coupons"], int), "active_coupons should be int"
        assert isinstance(summary["expired_coupons"], int), "expired_coupons should be int"
        assert isinstance(summary["total_usage"], int), "total_usage should be int"
        assert isinstance(summary["total_discounted_amount"], (int, float)), "total_discounted_amount should be numeric"
        
        print(f"✓ Summary contains all required fields: {summary}")
    
    def test_advanced_statistics_has_top_coupons(self):
        """Test that response contains top_coupons list"""
        response = requests.get(f"{BASE_URL}/api/coupons/statistics/advanced")
        assert response.status_code == 200
        data = response.json()
        
        assert "top_coupons" in data, "Response missing 'top_coupons' field"
        assert isinstance(data["top_coupons"], list), "top_coupons should be a list"
        
        # If there are top coupons, validate structure
        if len(data["top_coupons"]) > 0:
            coupon = data["top_coupons"][0]
            assert "code" in coupon, "Top coupon missing 'code'"
            assert "usage_count" in coupon, "Top coupon missing 'usage_count'"
            assert "total_discount" in coupon, "Top coupon missing 'total_discount'"
        
        print(f"✓ Top coupons list present with {len(data['top_coupons'])} items")
    
    def test_advanced_statistics_has_monthly_report(self):
        """Test that response contains monthly_report list"""
        response = requests.get(f"{BASE_URL}/api/coupons/statistics/advanced")
        assert response.status_code == 200
        data = response.json()
        
        assert "monthly_report" in data, "Response missing 'monthly_report' field"
        assert isinstance(data["monthly_report"], list), "monthly_report should be a list"
        
        # If there are monthly reports, validate structure
        if len(data["monthly_report"]) > 0:
            report = data["monthly_report"][0]
            assert "month" in report, "Monthly report missing 'month'"
            assert "transactions" in report, "Monthly report missing 'transactions'"
            assert "total_discount" in report, "Monthly report missing 'total_discount'"
            assert "total_revenue" in report, "Monthly report missing 'total_revenue'"
        
        print(f"✓ Monthly report list present with {len(data['monthly_report'])} items")
    
    def test_advanced_statistics_has_type_distribution(self):
        """Test that response contains type_distribution"""
        response = requests.get(f"{BASE_URL}/api/coupons/statistics/advanced")
        assert response.status_code == 200
        data = response.json()
        
        assert "type_distribution" in data, "Response missing 'type_distribution' field"
        type_dist = data["type_distribution"]
        
        assert "percentage" in type_dist, "type_distribution missing 'percentage'"
        assert "fixed" in type_dist, "type_distribution missing 'fixed'"
        assert isinstance(type_dist["percentage"], int), "percentage count should be int"
        assert isinstance(type_dist["fixed"], int), "fixed count should be int"
        
        print(f"✓ Type distribution: percentage={type_dist['percentage']}, fixed={type_dist['fixed']}")
    
    def test_advanced_statistics_has_email_statistics(self):
        """Test that response contains email_statistics"""
        response = requests.get(f"{BASE_URL}/api/coupons/statistics/advanced")
        assert response.status_code == 200
        data = response.json()
        
        assert "email_statistics" in data, "Response missing 'email_statistics' field"
        email_stats = data["email_statistics"]
        
        assert "sent" in email_stats, "email_statistics missing 'sent'"
        assert "pending" in email_stats, "email_statistics missing 'pending'"
        assert "failed" in email_stats, "email_statistics missing 'failed'"
        
        print(f"✓ Email statistics: sent={email_stats['sent']}, pending={email_stats['pending']}, failed={email_stats['failed']}")


class TestCouponEmailSending:
    """Test coupon email sending endpoint"""
    
    def test_send_email_with_valid_coupon(self):
        """Test sending email with a valid coupon code"""
        # First get a valid coupon code
        list_response = requests.get(f"{BASE_URL}/api/coupons/list")
        assert list_response.status_code == 200
        coupons = list_response.json().get("coupons", [])
        
        if len(coupons) == 0:
            pytest.skip("No coupons available for testing")
        
        coupon_code = coupons[0]["code"]
        
        # Send email
        response = requests.post(
            f"{BASE_URL}/api/coupons/send-email",
            json={
                "coupon_code": coupon_code,
                "recipient_email": "test@example.com",
                "recipient_name": "Test User"
            }
        )
        
        # Should return 200 (either sent or queued)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "message" in data, "Response missing 'message'"
        assert "recipient" in data or "recipient_email" in data or "email_preview" in data, "Response missing recipient info"
        
        print(f"✓ Email send response: {data}")
    
    def test_send_email_with_invalid_coupon(self):
        """Test sending email with invalid coupon code returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/coupons/send-email",
            json={
                "coupon_code": "INVALID_NONEXISTENT_CODE_12345",
                "recipient_email": "test@example.com"
            }
        )
        
        assert response.status_code == 404, f"Expected 404 for invalid coupon, got {response.status_code}"
        print(f"✓ Invalid coupon returns 404 as expected")
    
    def test_send_email_missing_email_field(self):
        """Test sending email without recipient_email returns 422"""
        # First get a valid coupon code
        list_response = requests.get(f"{BASE_URL}/api/coupons/list")
        coupons = list_response.json().get("coupons", [])
        
        if len(coupons) == 0:
            pytest.skip("No coupons available for testing")
        
        coupon_code = coupons[0]["code"]
        
        response = requests.post(
            f"{BASE_URL}/api/coupons/send-email",
            json={
                "coupon_code": coupon_code
                # Missing recipient_email
            }
        )
        
        assert response.status_code == 422, f"Expected 422 for missing email, got {response.status_code}"
        print(f"✓ Missing email field returns 422 as expected")


class TestUsageChartData:
    """Test usage chart data endpoint"""
    
    def test_usage_chart_endpoint_returns_200(self):
        """Test that usage chart endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/coupons/statistics/usage-chart")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Usage chart endpoint returns 200")
    
    def test_usage_chart_has_chart_data(self):
        """Test that response contains chart_data list"""
        response = requests.get(f"{BASE_URL}/api/coupons/statistics/usage-chart")
        assert response.status_code == 200
        data = response.json()
        
        assert "chart_data" in data, "Response missing 'chart_data' field"
        assert isinstance(data["chart_data"], list), "chart_data should be a list"
        
        # Should have 30+ days of data
        assert len(data["chart_data"]) >= 30, f"Expected at least 30 days of data, got {len(data['chart_data'])}"
        
        # Validate structure of first item
        if len(data["chart_data"]) > 0:
            item = data["chart_data"][0]
            assert "date" in item, "Chart data item missing 'date'"
            assert "usage_count" in item, "Chart data item missing 'usage_count'"
            assert "discount_amount" in item, "Chart data item missing 'discount_amount'"
        
        print(f"✓ Chart data contains {len(data['chart_data'])} days of data")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
