'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Zap,
  AlertTriangle,
  RotateCcw,
  MessageCircle,
  Smartphone,
  Check,
  ArrowRight,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import type { WhatsAppConfig as WhatsAppConfigType } from '@/types';

interface PendingPhoneOption {
  id: string;
  user_id: string;
  phone_number_id: string;
  waba_id: string | null;
  display_phone_number: string;
  verified_name: string | null;
  quality_rating: string | null;
}

const MASKED_TOKEN = '••••••••••••••••';

type ConnectionStatus = 'connected' | 'disconnected' | 'unknown';
type ResetReason = 'token_corrupted' | 'meta_api_error' | 'oauth_failed' | null;

export function WhatsAppConfig() {
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const oauthParam = searchParams.get('oauth');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [config, setConfig] = useState<WhatsAppConfigType | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [resetReason, setResetReason] = useState<ResetReason>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [tokenEdited, setTokenEdited] = useState(false);

  // OAuth phone picker state
  const [pendingPhones, setPendingPhones] = useState<PendingPhoneOption[]>([]);
  const [pendingWabaName, setPendingWabaName] = useState<string | null>(null);
  const [showPhonePicker, setShowPhonePicker] = useState(false);
  const [selectedPhoneId, setSelectedPhoneId] = useState<string | null>(null);
  const [completingOAuth, setCompletingOAuth] = useState(false);

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/whatsapp/webhook`
      : '';

  // Handle OAuth callback states
  useEffect(() => {
    if (!oauthParam) return;

    if (oauthParam === 'success') {
      const phone = searchParams.get('phone');
      const name = searchParams.get('name');
      toast.success(
        name
          ? `Connected to ${decodeURIComponent(name)} (${decodeURIComponent(phone ?? '')})`
          : 'WhatsApp connected successfully!'
      );
    } else if (oauthParam === 'denied') {
      toast.error('You denied the connection request. No changes were made.');
    } else if (oauthParam === 'pick') {
      setShowPhonePicker(true);
      toast.info('Select which phone number to connect');
    } else if (oauthParam === 'error') {
      const reason = searchParams.get('reason');
      toast.error(reason ? `Connection failed: ${decodeURIComponent(reason)}` : 'Connection failed');
    }
  }, [oauthParam, searchParams]);

  const fetchConfig = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Failed to load config row:', error);
      }

      if (data) {
        setConfig(data);
        setPhoneNumberId(data.phone_number_id || '');
        setWabaId(data.waba_id || '');
        setAccessToken(MASKED_TOKEN);
        setVerifyToken('');
        setTokenEdited(false);

        // If status is pending_oauth, show the phone picker
        if (data.status === 'pending_oauth') {
          setShowPhonePicker(true);
          fetchPendingPhones();
          return;
        }

        try {
          const res = await fetch('/api/whatsapp/config', { method: 'GET' });
          const payload = await res.json();

          if (payload.connected) {
            setConnectionStatus('connected');
            setResetReason(null);
            setStatusMessage('');
          } else {
            setConnectionStatus('disconnected');
            setResetReason(
              payload.needs_reset
                ? 'token_corrupted'
                : payload.reason === 'meta_api_error'
                  ? 'meta_api_error'
                  : null
            );
            setStatusMessage(payload.message || '');
          }
        } catch (err) {
          console.error('Health check failed:', err);
          setConnectionStatus('disconnected');
        }
      } else {
        setConfig(null);
        setPhoneNumberId('');
        setWabaId('');
        setAccessToken('');
        setVerifyToken('');
        setTokenEdited(false);
        setConnectionStatus('disconnected');
        setResetReason(null);
        setStatusMessage('');

        try {
          const res = await fetch('/api/whatsapp/config', { method: 'GET' });
          const payload = await res.json();
          if (payload.default_token || payload.default_phone_number_id || payload.default_waba_id) {
            if (payload.default_token) {
              setAccessToken(payload.default_token);
              setTokenEdited(true);
            }
            if (payload.default_phone_number_id) {
              setPhoneNumberId(payload.default_phone_number_id);
            }
            if (payload.default_waba_id) {
              setWabaId(payload.default_waba_id);
            }
            toast.info('Meta credentials pre-filled from environment');
          }
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.error('fetchConfig error:', err);
      toast.error('Failed to load WhatsApp configuration');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const fetchPendingPhones = async () => {
    try {
      const res = await fetch('/api/whatsapp/auth/pending');
      const data = await res.json();
      if (data.pending && data.phones?.length > 0) {
        setPendingPhones(data.phones);
        setPendingWabaName(data.wabaName);
      }
    } catch (err) {
      console.error('Failed to fetch pending phones:', err);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    fetchConfig(user.id);
  }, [authLoading, user, fetchConfig]);

  const handleOAuthConnect = () => {
    window.location.href = '/api/whatsapp/auth';
  };

  const handleCompleteOAuth = async () => {
    if (!selectedPhoneId) {
      toast.error('Please select a phone number');
      return;
    }

    try {
      setCompletingOAuth(true);
      const res = await fetch('/api/whatsapp/auth/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number_id: selectedPhoneId }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to complete setup');
        return;
      }

      toast.success(data.name ? `Connected to ${data.name} (${data.phone})` : 'WhatsApp connected successfully!');
      setShowPhonePicker(false);
      setPendingPhones([]);
      setSelectedPhoneId(null);
      if (user) await fetchConfig(user.id);
    } catch (err) {
      console.error('OAuth complete error:', err);
      toast.error('Failed to complete setup');
    } finally {
      setCompletingOAuth(false);
    }
  };

  async function handleSave() {
    if (!phoneNumberId.trim()) {
      toast.error('Phone Number ID is required');
      return;
    }
    if (!config && (!accessToken.trim() || !tokenEdited)) {
      toast.error('Access Token is required for initial setup');
      return;
    }

    try {
      setSaving(true);

      const payload: Record<string, unknown> = {
        phone_number_id: phoneNumberId.trim(),
        waba_id: wabaId.trim() || null,
        verify_token: verifyToken.trim() || null,
      };

      if (tokenEdited && accessToken !== MASKED_TOKEN && accessToken.trim()) {
        payload.access_token = accessToken.trim();
      } else if (config) {
        toast.error('Please re-enter the Access Token to save changes');
        setSaving(false);
        return;
      }

      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to save configuration');
        setSaving(false);
        return;
      }

      toast.success(
        data.phone_info?.verified_name
          ? `Connected to ${data.phone_info.verified_name}`
          : 'Configuration saved successfully'
      );

      if (user) await fetchConfig(user.id);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    try {
      setTesting(true);
      const res = await fetch('/api/whatsapp/config', { method: 'GET' });
      const payload = await res.json();

      if (payload.connected) {
        setConnectionStatus('connected');
        setResetReason(null);
        setStatusMessage('');
        toast.success(
          payload.phone_info?.verified_name
            ? `Connected to ${payload.phone_info.verified_name}`
            : 'API connection successful'
        );
      } else {
        setConnectionStatus('disconnected');
        setResetReason(payload.needs_reset ? 'token_corrupted' : payload.reason === 'meta_api_error' ? 'meta_api_error' : null);
        setStatusMessage(payload.message || '');
        toast.error(payload.message || 'API connection failed');
      }
    } catch (err) {
      console.error('Test connection error:', err);
      setConnectionStatus('disconnected');
      toast.error('Connection test failed. Check network and try again.');
    } finally {
      setTesting(false);
    }
  }

  async function handleReset() {
    if (!confirm('This will delete the current WhatsApp config so you can re-enter it. Continue?')) {
      return;
    }

    try {
      setResetting(true);
      const res = await fetch('/api/whatsapp/config', { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to reset configuration');
        return;
      }

      toast.success('Configuration cleared. You can now re-enter your credentials.');
      setConfig(null);
      setPhoneNumberId('');
      setWabaId('');
      setAccessToken('');
      setVerifyToken('');
      setTokenEdited(false);
      setConnectionStatus('disconnected');
      setResetReason(null);
      setStatusMessage('');
    } catch (err) {
      console.error('Reset error:', err);
      toast.error('Failed to reset configuration');
    } finally {
      setResetting(false);
    }
  }

  function handleCopyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied to clipboard');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const showResetBanner = resetReason === 'token_corrupted' || resetReason === 'oauth_failed';

  // OAuth phone picker screen
  if (showPhonePicker) {
    return (
      <div className="mx-auto mt-8 max-w-lg">
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Smartphone className="size-7 text-primary" />
            </div>
            <CardTitle className="text-white text-xl">Select Phone Number</CardTitle>
            <CardDescription className="text-slate-400">
              {pendingWabaName
                ? `Choose which phone number to connect from ${pendingWabaName}`
                : 'Choose which phone number to connect'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingPhones.length === 0 ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            ) : (
              pendingPhones.map((phone) => (
                <button
                  key={phone.phone_number_id}
                  onClick={() => setSelectedPhoneId(phone.phone_number_id)}
                  className={`flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors ${
                    selectedPhoneId === phone.phone_number_id
                      ? 'border-primary bg-primary/5'
                      : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800'
                  }`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    selectedPhoneId === phone.phone_number_id
                      ? 'bg-primary text-white'
                      : 'bg-slate-700 text-slate-300'
                  }`}>
                    {selectedPhoneId === phone.phone_number_id ? (
                      <Check className="size-5" />
                    ) : (
                      <Smartphone className="size-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {phone.display_phone_number}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {phone.verified_name ?? 'Unverified'}
                    </p>
                  </div>
                  {phone.quality_rating && (
                    <span className={`shrink-0 text-[10px] font-medium uppercase ${
                      phone.quality_rating === 'green' ? 'text-green-400' :
                      phone.quality_rating === 'yellow' ? 'text-amber-400' :
                      'text-red-400'
                    }`}>
                      {phone.quality_rating}
                    </span>
                  )}
                </button>
              ))
            )}

            <Button
              className="mt-2 w-full"
              onClick={handleCompleteOAuth}
              disabled={!selectedPhoneId || completingOAuth}
            >
              {completingOAuth ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <ArrowRight className="size-4" />
                  Connect Selected Number
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] mt-4">
      {/* Main config form */}
      <div className="space-y-6">
        {/* Corrupted-token reset banner */}
        {showResetBanner && (
          <Alert className="bg-amber-950/40 border-amber-600/40">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <AlertTitle className="text-amber-200 mb-1">
                  {resetReason === 'token_corrupted' ? "Stored token can't be decrypted" : 'OAuth setup failed'}
                </AlertTitle>
                <AlertDescription className="text-amber-100/80 text-sm">
                  {statusMessage}
                </AlertDescription>
                <Button
                  onClick={handleReset}
                  disabled={resetting}
                  size="sm"
                  className="mt-3 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {resetting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="size-4" />
                      Reset Configuration
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Alert>
        )}

        {/* Connection Status */}
        <Alert className="bg-slate-900 border-slate-700">
          <div className="flex items-center gap-2">
            {connectionStatus === 'connected' ? (
              <CheckCircle2 className="size-4 text-primary" />
            ) : (
              <XCircle className="size-4 text-red-500" />
            )}
            <AlertTitle className="text-white mb-0">
              {connectionStatus === 'connected' ? 'Connected' : 'Not Connected'}
            </AlertTitle>
          </div>
          <AlertDescription className="text-slate-400">
            {connectionStatus === 'connected'
              ? 'Your WhatsApp Business API is connected and ready to send/receive messages.'
              : statusMessage ||
                'Connect your WhatsApp Business account to get started.'}
          </AlertDescription>
        </Alert>

        {/* OAuth Connect Button */}
        <Card className="bg-slate-900 border-slate-700 ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-white">Quick Connect</CardTitle>
            <CardDescription className="text-slate-400">
              Connect your WhatsApp Business account with one click — no manual token setup needed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleOAuthConnect}
              size="lg"
              className="w-full gap-3 bg-[#1877F2] hover:bg-[#166FE5] text-white"
            >
              <MessageCircle className="size-5" />
              Connect with Meta
            </Button>
            <p className="mt-2 text-xs text-slate-500 text-center">
              You&apos;ll be redirected to Meta to authorize access to your WhatsApp Business Account.
            </p>
          </CardContent>
        </Card>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-700" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#0f1729] px-2 text-slate-500">Or connect manually</span>
          </div>
        </div>

        {/* API Credentials */}
        <Card className="bg-slate-900 border-slate-700 ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-white">API Credentials</CardTitle>
            <CardDescription className="text-slate-400">
              Enter your Meta WhatsApp Business API credentials manually.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Phone Number ID</Label>
              <Input
                placeholder="e.g. 100234567890123"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">WhatsApp Business Account ID</Label>
              <Input
                placeholder="e.g. 100234567890456"
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Permanent Access Token</Label>
              <div className="relative">
                <Input
                  type={showToken ? 'text' : 'password'}
                  placeholder="Enter your access token"
                  value={accessToken}
                  onChange={(e) => {
                    setAccessToken(e.target.value);
                    setTokenEdited(true);
                  }}
                  onFocus={() => {
                    if (accessToken === MASKED_TOKEN) {
                      setAccessToken('');
                      setTokenEdited(true);
                    }
                  }}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {config && !tokenEdited && (
                <p className="text-xs text-slate-500">
                  Token is hidden for security. Re-enter it to update configuration.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Webhook Verify Token</Label>
              <Input
                placeholder="Create a custom verify token"
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
              <p className="text-xs text-slate-500">
                A custom string you create. Must match the token you set in Meta webhook settings.
                Not needed if using Quick Connect.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Webhook URL */}
        <Card className="bg-slate-900 border-slate-700 ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-white">Webhook Configuration</CardTitle>
            <CardDescription className="text-slate-400">
              Use this URL as your webhook callback in the Meta App Dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label className="text-slate-300">Webhook Callback URL</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={webhookUrl}
                  className="bg-slate-800 border-slate-700 text-slate-300 font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyWebhookUrl}
                  className="shrink-0 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Configuration'
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing || !config}
            className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
          >
            {testing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Zap className="size-4" />
                Test API Connection
              </>
            )}
          </Button>
          {config && (
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={resetting}
              className="border-red-900 text-red-400 hover:text-red-300 hover:bg-red-950/40"
            >
              {resetting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <RotateCcw className="size-4" />
                  Reset Configuration
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Setup Instructions Sidebar */}
      <div>
        <Card className="bg-slate-900 border-slate-700 ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-white text-base">Setup Instructions</CardTitle>
            <CardDescription className="text-slate-400">
              Two ways to connect — Quick Connect (recommended) or manual setup.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <h4 className="flex items-center gap-2 text-sm font-medium text-primary mb-2">
                <MessageCircle className="size-4" />
                Quick Connect (Recommended)
              </h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-slate-300">
                <li>Click <strong className="text-white">Connect with Meta</strong></li>
                <li>Log in to your Facebook account</li>
                <li>Select your WhatsApp Business Account</li>
                <li>Pick the phone number to connect</li>
                <li>Done — webhook is configured automatically</li>
              </ol>
            </div>

            <Accordion>
              <AccordionItem className="border-slate-700">
                <AccordionTrigger className="text-slate-300 hover:text-white hover:no-underline text-sm">
                  <span className="flex items-center gap-2">
                    Manual setup steps
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-300">1. Create a Meta App</p>
                    <p className="text-xs text-slate-400">Go to developers.facebook.com → My Apps → Create App → Business</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-300">2. Add WhatsApp product</p>
                    <p className="text-xs text-slate-400">In your app dashboard, add the WhatsApp product and link your business</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-300">3. Get credentials</p>
                    <p className="text-xs text-slate-400">From WhatsApp &gt; API Setup, copy Phone Number ID, WABA ID, and generate a Permanent Access Token from Business Settings &gt; System Users</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-300">4. Configure webhook</p>
                    <p className="text-xs text-slate-400">Paste the Webhook Callback URL and Verify Token in WhatsApp &gt; Configuration. Subscribe to &quot;messages&quot; field.</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="pt-4 border-t border-slate-700">
              <a
                href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                <ExternalLink className="size-3.5" />
                Meta WhatsApp API Documentation
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
