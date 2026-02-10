import React, { useState, useEffect } from "react";
import {
  CreditCard,
  Building2,
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Save,
  AlertTriangle,
  ExternalLink,
  Zap,
  Info,
} from "lucide-react";

// API base URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PaymentSettings {
  gateway_type: "easebuzz" | "razorpay" | "none";
  merchant_id?: string;
  api_key?: string;
  api_secret?: string;
  webhook_secret?: string;
  environment: "sandbox" | "production";
  configured: boolean;
}

const PaymentSettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<PaymentSettings>({
    gateway_type: "none",
    merchant_id: "",
    api_key: "",
    api_secret: "",
    webhook_secret: "",
    environment: "sandbox",
    configured: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Load existing settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch(`${API_URL}/api/payments/settings`);
        if (response.ok) {
          const data = await response.json();
          setSettings((prev) => ({
            ...prev,
            gateway_type: data.gateway_type || "none",
            merchant_id: data.merchant_id || "",
            environment: data.environment || "sandbox",
            configured: data.configured || false,
          }));
        }
      } catch (error) {
        console.error("Failed to load payment settings:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);

    try {
      const response = await fetch(`${API_URL}/api/payments/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateway_type: settings.gateway_type,
          merchant_id: settings.merchant_id,
          api_key: settings.api_key,
          api_secret: settings.api_secret,
          webhook_secret: settings.webhook_secret,
          environment: settings.environment,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setTestResult({
          success: true,
          message: "Settings saved successfully!",
        });
        setSettings((prev) => ({ ...prev, configured: true }));
      } else {
        setTestResult({
          success: false,
          message: data.detail || "Failed to save settings",
        });
      }
    } catch (error) {
      setTestResult({ success: false, message: "Connection error" });
    } finally {
      setSaving(false);
    }
  };

  const gatewayInfo = {
    easebuzz: {
      name: "Easebuzz",
      logo: "🟢",
      color: "emerald",
      signupUrl: "https://easebuzz.in/merchant-signup",
      docsUrl: "https://docs.easebuzz.in/",
      description: "Popular Indian payment gateway with competitive rates",
    },
    razorpay: {
      name: "Razorpay",
      logo: "🔵",
      color: "blue",
      signupUrl: "https://razorpay.com/signup/",
      docsUrl: "https://razorpay.com/docs/",
      description: "Feature-rich payment platform trusted by 8M+ businesses",
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-200">
          <CreditCard className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Payment Gateway</h3>
          <p className="text-slate-500">
            Configure how guests pay for their bookings
          </p>
        </div>
      </div>

      {/* Gateway Selection */}
      <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-xl shadow-slate-100/50">
        <h4 className="text-lg font-bold text-slate-800 mb-4">
          Select Payment Gateway
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* No Gateway */}
          <button
            onClick={() =>
              setSettings((prev) => ({ ...prev, gateway_type: "none" }))
            }
            className={`relative p-6 rounded-2xl border-2 transition-all text-left ${
              settings.gateway_type === "none"
                ? "border-slate-400 bg-slate-50"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="text-3xl mb-3">⚫</div>
            <h5 className="font-bold text-slate-900">None</h5>
            <p className="text-sm text-slate-500 mt-1">
              Collect payments manually or at check-in
            </p>
            {settings.gateway_type === "none" && (
              <div className="absolute top-3 right-3">
                <CheckCircle2 className="w-5 h-5 text-slate-600" />
              </div>
            )}
          </button>

          {/* Easebuzz */}
          <button
            onClick={() =>
              setSettings((prev) => ({ ...prev, gateway_type: "easebuzz" }))
            }
            className={`relative p-6 rounded-2xl border-2 transition-all text-left ${
              settings.gateway_type === "easebuzz"
                ? "border-emerald-400 bg-emerald-50"
                : "border-slate-200 hover:border-emerald-200"
            }`}
          >
            <div className="text-3xl mb-3">🟢</div>
            <h5 className="font-bold text-slate-900">Easebuzz</h5>
            <p className="text-sm text-slate-500 mt-1">
              Popular gateway with competitive rates
            </p>
            {settings.gateway_type === "easebuzz" && (
              <div className="absolute top-3 right-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
            )}
          </button>

          {/* Razorpay */}
          <button
            onClick={() =>
              setSettings((prev) => ({ ...prev, gateway_type: "razorpay" }))
            }
            className={`relative p-6 rounded-2xl border-2 transition-all text-left ${
              settings.gateway_type === "razorpay"
                ? "border-blue-400 bg-blue-50"
                : "border-slate-200 hover:border-blue-200"
            }`}
          >
            <div className="text-3xl mb-3">🔵</div>
            <h5 className="font-bold text-slate-900">Razorpay</h5>
            <p className="text-sm text-slate-500 mt-1">
              Feature-rich platform, 8M+ businesses
            </p>
            {settings.gateway_type === "razorpay" && (
              <div className="absolute top-3 right-3">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Credentials Form */}
      {settings.gateway_type !== "none" && (
        <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-xl shadow-slate-100/50 space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold text-slate-800">
              {gatewayInfo[settings.gateway_type].name} Credentials
            </h4>
            <a
              href={gatewayInfo[settings.gateway_type].signupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Don't have an account?
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Info Banner */}
          <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
            <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">
                Each hotel owner needs their own account
              </p>
              <p className="mt-1 text-amber-700">
                Register at {gatewayInfo[settings.gateway_type].name} with your
                business details. Payments will go directly to your bank
                account.
              </p>
            </div>
          </div>

          {/* Environment Toggle */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Environment
            </label>
            <div className="flex gap-3">
              <button
                onClick={() =>
                  setSettings((prev) => ({ ...prev, environment: "sandbox" }))
                }
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
                  settings.environment === "sandbox"
                    ? "bg-amber-100 text-amber-700 border-2 border-amber-300"
                    : "bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200"
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                Sandbox (Test)
              </button>
              <button
                onClick={() =>
                  setSettings((prev) => ({
                    ...prev,
                    environment: "production",
                  }))
                }
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
                  settings.environment === "production"
                    ? "bg-green-100 text-green-700 border-2 border-green-300"
                    : "bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200"
                }`}
              >
                <Zap className="w-4 h-4" />
                Production (Live)
              </button>
            </div>
          </div>

          {/* Easebuzz Fields */}
          {settings.gateway_type === "easebuzz" && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Merchant ID / Key
                </label>
                <input
                  type="text"
                  value={settings.merchant_id || ""}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      merchant_id: e.target.value,
                    }))
                  }
                  placeholder="Enter your Easebuzz Merchant Key"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  API Key
                </label>
                <input
                  type="text"
                  value={settings.api_key || ""}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      api_key: e.target.value,
                    }))
                  }
                  placeholder="Your Easebuzz API Key"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Salt (Secret Key)
                </label>
                <div className="relative">
                  <input
                    type={showSecrets ? "text" : "password"}
                    value={settings.api_secret || ""}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        api_secret: e.target.value,
                      }))
                    }
                    placeholder="Your Easebuzz Salt"
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets(!showSecrets)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showSecrets ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Razorpay Fields */}
          {settings.gateway_type === "razorpay" && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Key ID
                </label>
                <input
                  type="text"
                  value={settings.api_key || ""}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      api_key: e.target.value,
                    }))
                  }
                  placeholder="rzp_live_xxxxxxxxxx or rzp_test_xxxxxxxxxx"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Key Secret
                </label>
                <div className="relative">
                  <input
                    type={showSecrets ? "text" : "password"}
                    value={settings.api_secret || ""}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        api_secret: e.target.value,
                      }))
                    }
                    placeholder="Your Razorpay Key Secret"
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets(!showSecrets)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showSecrets ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Webhook Secret{" "}
                  <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <input
                    type={showSecrets ? "text" : "password"}
                    value={settings.webhook_secret || ""}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        webhook_secret: e.target.value,
                      }))
                    }
                    placeholder="Webhook signing secret"
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets(!showSecrets)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showSecrets ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Webhook URL Info */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h5 className="font-medium text-slate-700 mb-2">Webhook URL</h5>
            <code className="block p-3 bg-slate-800 text-emerald-400 rounded-lg text-sm font-mono break-all">
              {typeof window !== "undefined"
                ? window.location.origin
                : "https://yoursite.com"}
              /api/payments/webhooks/{settings.gateway_type}
            </code>
            <p className="text-xs text-slate-500 mt-2">
              Register this URL in your{" "}
              {gatewayInfo[settings.gateway_type].name} dashboard to receive
              payment notifications.
            </p>
          </div>

          {/* Result Message */}
          {testResult && (
            <div
              className={`flex items-center gap-3 p-4 rounded-xl ${
                testResult.success
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              <span
                className={
                  testResult.success ? "text-green-700" : "text-red-700"
                }
              >
                {testResult.message}
              </span>
            </div>
          )}

          {/* Save Button */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {saving ? "Saving..." : "Save Settings"}
            </button>

            <a
              href={gatewayInfo[settings.gateway_type].docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              View Documentation
            </a>
          </div>
        </div>
      )}

      {/* No Gateway Info */}
      {settings.gateway_type === "none" && (
        <div className="bg-slate-50 rounded-3xl border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 mx-auto bg-slate-200 rounded-full flex items-center justify-center mb-4">
            <CreditCard className="w-8 h-8 text-slate-500" />
          </div>
          <h4 className="text-lg font-bold text-slate-700 mb-2">
            No Payment Gateway Configured
          </h4>
          <p className="text-slate-500 max-w-md mx-auto">
            You can still collect payments manually at check-in or through bank
            transfer. Select Easebuzz or Razorpay above to enable online
            payments.
          </p>
        </div>
      )}

      {/* Security Note */}
      <div className="flex items-start gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
        <Shield className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-green-800">
          <p className="font-medium">PCI DSS Compliant</p>
          <p className="mt-1 text-green-700">
            Your credentials are stored securely. Card data never touches your
            servers - it goes directly to the payment gateway.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentSettingsPanel;
