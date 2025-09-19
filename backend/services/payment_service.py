import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from models.payment import Payment, PaymentCreate, PaymentStatus, PaymentMethod
from services.notification_service import NotificationService
from services.subscription_service import SubscriptionService

logger = logging.getLogger(__name__)

class PaymentService:
    def __init__(self, db, notification_service: NotificationService, subscription_service: SubscriptionService):
        self.db = db
        self.notification_service = notification_service
        self.subscription_service = subscription_service

    async def process_payment(self, payment_data: PaymentCreate) -> Payment:
        """Process a new payment"""
        try:
            # Create payment record
            payment = Payment(**payment_data.dict())
            payment.status = PaymentStatus.PROCESSING
            
            # Save to database
            await self.db.payments.insert_one(payment.dict())
            
            # Process payment based on method
            if payment.payment_method == PaymentMethod.CARD:
                result = await self._process_card_payment(payment)
            elif payment.payment_method == PaymentMethod.FAWRY:
                result = await self._process_fawry_payment(payment)
            elif payment.payment_method == PaymentMethod.BANK:
                result = await self._process_bank_payment(payment)
            elif payment.payment_method == PaymentMethod.WALLET:
                result = await self._process_wallet_payment(payment)
            else:
                raise ValueError(f"Unsupported payment method: {payment.payment_method}")
            
            # Update payment status
            payment.status = PaymentStatus.COMPLETED if result['success'] else PaymentStatus.FAILED
            payment.gateway_response = result
            payment.updated_at = datetime.utcnow()
            
            if result['success']:
                payment.completed_at = datetime.utcnow()
                
                # Create subscription
                await self.subscription_service.create_subscription(payment)
                
                # Send success notifications
                await self._send_payment_notifications(payment, 'success')
            else:
                # Send failure notifications
                await self._send_payment_notifications(payment, 'failure')
            
            # Update payment in database
            await self.db.payments.update_one(
                {"id": payment.id},
                {"$set": payment.dict()}
            )
            
            return payment
            
        except Exception as e:
            logger.error(f"Payment processing failed: {str(e)}")
            raise

    async def _process_card_payment(self, payment: Payment) -> Dict[str, Any]:
        """Process credit/debit card payment"""
        try:
            # Simulate card payment processing
            # In real implementation, integrate with Stripe, Paymob, or other payment gateway
            
            # Mock successful payment
            await asyncio.sleep(2)  # Simulate processing time
            
            return {
                'success': True,
                'gateway': 'stripe',
                'gateway_transaction_id': f"pi_{payment.transaction_id}",
                'message': 'Payment successful',
                'processing_fee': payment.amount * 0.029  # 2.9% processing fee
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': 'Card payment failed'
            }

    async def _process_fawry_payment(self, payment: Payment) -> Dict[str, Any]:
        """Process Fawry payment"""
        try:
            # Generate Fawry payment code
            fawry_code = f"FWR{payment.transaction_id[-8:]}"
            
            return {
                'success': True,
                'gateway': 'fawry',
                'payment_code': fawry_code,
                'message': 'Fawry payment code generated',
                'instructions': f'Visit any Fawry location and use code: {fawry_code}'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': 'Fawry payment failed'
            }

    async def _process_bank_payment(self, payment: Payment) -> Dict[str, Any]:
        """Process bank transfer payment"""
        try:
            return {
                'success': True,
                'gateway': 'bank_transfer',
                'reference_number': payment.transaction_id,
                'message': 'Bank transfer initiated',
                'bank_details': {
                    'account_name': 'DataLife Account Ltd',
                    'bank_name': 'Commercial International Bank',
                    'account_number': '123456789',
                    'reference': payment.transaction_id
                }
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': 'Bank transfer failed'
            }

    async def _process_wallet_payment(self, payment: Payment) -> Dict[str, Any]:
        """Process mobile wallet payment"""
        try:
            # Simulate wallet payment
            await asyncio.sleep(1)
            
            return {
                'success': True,
                'gateway': 'mobile_wallet',
                'wallet_transaction_id': f"MW{payment.transaction_id[-8:]}",
                'message': 'Mobile wallet payment successful'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': 'Mobile wallet payment failed'
            }

    async def _send_payment_notifications(self, payment: Payment, status: str):
        """Send payment notifications to customer and admin"""
        try:
            if status == 'success':
                # Send customer success email
                await self.notification_service.send_payment_confirmation_email(payment)
                
                # Send customer SMS
                await self.notification_service.send_payment_confirmation_sms(payment)
                
                # Send admin notification
                await self.notification_service.send_admin_payment_alert(payment)
                
            else:
                # Send customer failure email
                await self.notification_service.send_payment_failure_email(payment)
                
                # Send admin failure alert
                await self.notification_service.send_admin_payment_failure_alert(payment)
                
        except Exception as e:
            logger.error(f"Failed to send payment notifications: {str(e)}")

    async def get_payment_by_id(self, payment_id: str) -> Optional[Payment]:
        """Get payment by ID"""
        payment_data = await self.db.payments.find_one({"id": payment_id})
        if payment_data:
            return Payment(**payment_data)
        return None

    async def get_payments_by_email(self, email: str) -> list[Payment]:
        """Get all payments for a customer email"""
        payments_data = await self.db.payments.find({"customer_email": email}).to_list(100)
        return [Payment(**payment) for payment in payments_data]

    async def update_payment_status(self, payment_id: str, status: PaymentStatus, gateway_response: Dict[str, Any] = None):
        """Update payment status"""
        update_data = {
            "status": status,
            "updated_at": datetime.utcnow()
        }
        
        if gateway_response:
            update_data["gateway_response"] = gateway_response
            
        if status == PaymentStatus.COMPLETED:
            update_data["completed_at"] = datetime.utcnow()
        
        await self.db.payments.update_one(
            {"id": payment_id},
            {"$set": update_data}
        )