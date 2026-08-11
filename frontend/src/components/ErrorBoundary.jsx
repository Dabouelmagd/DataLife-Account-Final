import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }

  static getDerivedStateFromError(error) { return { hasError: true, error }; }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
    // Could send to error tracking service here
  }

  render() {
    if (this.state.hasError) {
      return (
        <div dir="rtl" className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="text-center max-w-md bg-white p-8 rounded-2xl shadow-lg border border-red-100">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">حدث خطأ غير متوقع</h1>
            <p className="text-gray-500 text-sm mb-6">Something went wrong. Please refresh the page.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-[#1e3a8a] text-white rounded-xl hover:bg-[#1e40af] transition-colors"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
