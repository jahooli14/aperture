import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, Eye, EyeOff, Download, ChevronRight, AlertCircle, Baby, Bell, BellRing } from 'lucide-react';
import { usePhotoStore } from '../stores/usePhotoStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { subscribeToPushNotifications, unsubscribeFromPushNotifications, getPushSubscriptionStatus, isPushNotificationSupported } from '../lib/notifications';

interface PrivacySettingsProps {
  onClose: () => void;
}

const PRIVACY_MODE_KEY = 'wizard-privacy-mode';
const PASSCODE_KEY = 'wizard-passcode';

export function PrivacySettings({ onClose }: PrivacySettingsProps) {
  const { photos } = usePhotoStore();
  const { settings, updateBirthdate, updateReminderSettings } = useSettingsStore();
  const [privacyMode, setPrivacyMode] = useState(false);
  const [hasPasscode, setHasPasscode] = useState(false);
  const [showPasscodeSetup, setShowPasscodeSetup] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [saving, setSaving] = useState(false);
  const [reminderEmail, setReminderEmail] = useState('');
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('19:00');
  const [savingReminders, setSavingReminders] = useState(false);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(false);
  const [pushNotificationsSupported, setPushNotificationsSupported] = useState(false);
  const [enablingPushNotifications, setEnablingPushNotifications] = useState(false);

  useEffect(() => {
    const savedPrivacyMode = localStorage.getItem(PRIVACY_MODE_KEY) === 'true';
    const savedPasscode = localStorage.getItem(PASSCODE_KEY);
    setPrivacyMode(savedPrivacyMode);
    setHasPasscode(!!savedPasscode);
  }, []);

  useEffect(() => {
    if (settings?.baby_birthdate) {
      setBirthdate(settings.baby_birthdate);
    }
    if (settings?.reminder_email) {
      setReminderEmail(settings.reminder_email);
    }
    if (settings?.reminders_enabled !== undefined) {
      setRemindersEnabled(settings.reminders_enabled);
    }
    if (settings?.reminder_time) {
      setReminderTime(settings.reminder_time);
    }
  }, [settings]);

  // Check push notification status on mount
  useEffect(() => {
    async function checkPushStatus() {
      try {
        const supported = isPushNotificationSupported();
        setPushNotificationsSupported(supported);

        if (supported) {
          const status = await getPushSubscriptionStatus();
          setPushNotificationsEnabled(status.subscribed);
        }
      } catch (error) {
        // Silently fail - push notifications just won't be available
        console.warn('Push notifications not available:', error);
        setPushNotificationsSupported(false);
      }
    }
    checkPushStatus();
  }, []);

  const handlePrivacyModeToggle = () => {
    const newValue = !privacyMode;
    setPrivacyMode(newValue);
    localStorage.setItem(PRIVACY_MODE_KEY, String(newValue));
  };

  const handleSetPasscode = () => {
    if (passcode.length < 4) {
      setPasscodeError('Passcode must be at least 4 digits');
      return;
    }
    if (passcode !== confirmPasscode) {
      setPasscodeError('Passcodes do not match');
      return;
    }
    localStorage.setItem(PASSCODE_KEY, passcode);
    setHasPasscode(true);
    setShowPasscodeSetup(false);
    setPasscode('');
    setConfirmPasscode('');
    setPasscodeError('');
  };

  const handleRemovePasscode = () => {
    if (confirm('Are you sure you want to remove your passcode?')) {
      localStorage.removeItem(PASSCODE_KEY);
      setHasPasscode(false);
    }
  };

  const handleSaveBirthdate = async () => {
    if (!birthdate) return;

    try {
      setSaving(true);
      await updateBirthdate(birthdate);
      setSaving(false);
    } catch (error) {
      setSaving(false);
      console.error('Birthdate save error:', error);

      // Check if it's a database column error
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('column') || errorMessage.includes('baby_birthdate')) {
        alert('Database migration needed! Please run the migration from QUICK_FIX_BIRTHDATE.md to add the birthdate column.');
      } else {
        alert('Failed to save birthdate. Please try again. Error: ' + errorMessage);
      }
    }
  };

  const handleSaveReminders = async () => {
    if (!reminderEmail || !reminderEmail.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    try {
      setSavingReminders(true);
      await updateReminderSettings({
        reminder_email: reminderEmail,
        reminders_enabled: remindersEnabled,
        reminder_time: reminderTime,
      });
      setSavingReminders(false);
    } catch (error) {
      setSavingReminders(false);
      console.error('Reminder settings save error:', error);
      alert('Failed to save reminder settings. Please try again.');
    }
  };

  const handleTogglePushNotifications = async () => {
    try {
      setEnablingPushNotifications(true);

      if (pushNotificationsEnabled) {
        // Unsubscribe
        await unsubscribeFromPushNotifications();
        setPushNotificationsEnabled(false);
      } else {
        // Subscribe
        const subscription = await subscribeToPushNotifications();
        setPushNotificationsEnabled(!!subscription);

        if (!subscription) {
          alert('Could not enable push notifications.\n\nPossible reasons:\n• Notification permission was denied\n• App needs to be installed to home screen (iOS requirement)\n• VAPID keys not configured on server\n\nCheck browser console (F12) for details.');
        }
      }
    } catch (error) {
      console.error('Push notification error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to enable push notifications:\n\n${errorMessage}\n\nCheck the browser console (F12) for more details.`);
    } finally {
      setEnablingPushNotifications(false);
    }
  };

  const handleExportData = () => {
    const data = {
      exportDate: new Date().toISOString(),
      photoCount: photos.length,
      photos: photos.map(photo => ({
        id: photo.id,
        uploadDate: photo.upload_date,
        createdAt: photo.created_at,
        hasEyeDetection: !!photo.eye_coordinates,
        isAligned: !!photo.aligned_url,
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wizard-of-oz-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Shield className="w-5 h-5 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Privacy & Security</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Privacy Mode */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3 flex-1">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  {privacyMode ? (
                    <EyeOff className="w-5 h-5 text-purple-600" />
                  ) : (
                    <Eye className="w-5 h-5 text-purple-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">Privacy Mode</h3>
                  <p className="text-sm text-gray-600">
                    Hide photo thumbnails in gallery view. Photos will show as blurred until tapped.
                  </p>
                </div>
              </div>
              <button
                onClick={handlePrivacyModeToggle}
                className={`
                  relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
                  transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                  ${privacyMode ? 'bg-primary-600' : 'bg-gray-200'}
                `}
              >
                <span
                  className={`
                    pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
                    transition duration-200 ease-in-out
                    ${privacyMode ? 'translate-x-5' : 'translate-x-0'}
                  `}
                />
              </button>
            </div>
          </div>

          {/* Baby's Birthdate */}
          <div className="bg-purple-50 rounded-xl p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Baby className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Baby's Birthdate</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Set your baby's birthdate to see age information on photos
                </p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="date"
                      value={birthdate}
                      onChange={(e) => setBirthdate(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                  <button
                    onClick={handleSaveBirthdate}
                    disabled={!birthdate || saving}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
                {settings?.baby_birthdate && (
                  <p className="text-xs text-purple-700 mt-2">
                    ✓ Birthdate set to {new Date(settings.baby_birthdate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Daily Reminders */}
          <div className="bg-blue-50 rounded-xl p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Bell className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Daily Photo Reminders</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Get an email reminder if you haven't uploaded today's photo
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={reminderEmail}
                      onChange={(e) => setReminderEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Reminder Time
                    </label>
                    <input
                      type="time"
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <label className="text-sm font-medium text-gray-900">
                      Enable reminders
                    </label>
                    <button
                      onClick={() => setRemindersEnabled(!remindersEnabled)}
                      className={`
                        relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
                        transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                        ${remindersEnabled ? 'bg-blue-600' : 'bg-gray-200'}
                      `}
                    >
                      <span
                        className={`
                          pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
                          transition duration-200 ease-in-out
                          ${remindersEnabled ? 'translate-x-5' : 'translate-x-0'}
                        `}
                      />
                    </button>
                  </div>

                  <button
                    onClick={handleSaveReminders}
                    disabled={!reminderEmail || savingReminders}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                  >
                    {savingReminders ? 'Saving...' : 'Save Reminder Settings'}
                  </button>

                  {settings?.reminders_enabled && (
                    <p className="text-xs text-blue-700">
                      ✓ Reminders enabled at {settings.reminder_time} in your timezone
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Push Notifications */}
          {pushNotificationsSupported && (
            <div className="bg-purple-50 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <BellRing className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">Push Notifications</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Get instant reminders on your device (preferred over email)
                  </p>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {pushNotificationsEnabled ? 'Enabled' : 'Disabled'}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {pushNotificationsEnabled
                          ? 'You\'ll receive instant notifications'
                          : 'Enable to get instant reminders'}
                      </p>
                    </div>
                    <button
                      onClick={handleTogglePushNotifications}
                      disabled={enablingPushNotifications}
                      className={`
                        relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
                        transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
                        disabled:opacity-50 disabled:cursor-not-allowed
                        ${pushNotificationsEnabled ? 'bg-purple-600' : 'bg-gray-200'}
                      `}
                    >
                      <span
                        className={`
                          pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
                          transition duration-200 ease-in-out
                          ${pushNotificationsEnabled ? 'translate-x-5' : 'translate-x-0'}
                        `}
                      />
                    </button>
                  </div>

                  {pushNotificationsEnabled && (
                    <div className="mt-3 p-3 bg-purple-100 rounded-lg">
                      <p className="text-xs text-purple-900">
                        ✓ Push notifications are active. You'll receive reminders even when the app is closed.
                      </p>
                    </div>
                  )}

                  {!pushNotificationsEnabled && (
                    <div className="mt-3 p-3 bg-gray-100 rounded-lg">
                      <p className="text-xs text-gray-700">
                        💡 Tip: Push notifications work even when you're not in the app. Perfect for daily reminders after 5pm!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Passcode Lock */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">App Lock</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Require a passcode to open the app
                </p>

                {!showPasscodeSetup ? (
                  <div className="space-y-2">
                    {hasPasscode ? (
                      <div className="flex gap-2">
                        <div className="flex-1 text-sm text-green-600 font-medium flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-600 rounded-full" />
                          Passcode enabled
                        </div>
                        <button
                          onClick={handleRemovePasscode}
                          className="text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowPasscodeSetup(true)}
                        className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
                      >
                        <span>Set up passcode</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Enter Passcode (4+ digits)
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={passcode}
                        onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="••••"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Confirm Passcode
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={confirmPasscode}
                        onChange={(e) => setConfirmPasscode(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="••••"
                      />
                    </div>
                    {passcodeError && (
                      <div className="flex items-center gap-2 text-xs text-red-600">
                        <AlertCircle className="w-3 h-3" />
                        {passcodeError}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowPasscodeSetup(false);
                          setPasscode('');
                          setConfirmPasscode('');
                          setPasscodeError('');
                        }}
                        className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSetPasscode}
                        className="flex-1 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Data Export */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Download className="w-5 h-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Export Your Data</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Download a JSON file with your photo metadata
                </p>
                <button
                  onClick={handleExportData}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-2"
                >
                  <span>Export data ({photos.length} photos)</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Privacy Info */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-green-900 text-sm mb-1">Your Data is Private</h4>
                <ul className="text-xs text-green-700 space-y-1">
                  <li>• Photos are stored securely in your private account</li>
                  <li>• Only you can access your photos</li>
                  <li>• We never share or sell your data</li>
                  <li>• All transfers are encrypted (HTTPS)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-2xl">
          <motion.button
            onClick={onClose}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Done
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
