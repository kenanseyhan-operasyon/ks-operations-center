export type CloudLanguage = 'tr' | 'en';

/** Keep provider messages (which can contain account data) out of the interface. */
export class CloudError extends Error {
  constructor(public code: string, public status = 0) { super(code); this.name = 'CloudError'; }
}
export class CloudConflict extends CloudError {
  constructor() { super('conflict'); }
}

const messages: Record<string, [string, string]> = {
  invalid_credentials: ['E-posta veya şifre hatalı. Bilgilerinizi kontrol edin ya da “Şifremi unuttum” seçeneğini kullanın.', 'The email or password is incorrect. Check your details or use “Forgot password”.'],
  email_not_confirmed: ['Giriş yapmak için e-posta adresinizi doğrulayın. Doğrulama e-postasını aşağıdan yeniden gönderebilirsiniz.', 'Verify your email before signing in. You can resend the verification email below.'],
  weak_password: ['En az 12 karakterli, daha güçlü bir şifre seçin. Yaygın veya daha önce sızdırılmış şifreleri kullanmayın.', 'Choose a stronger password with at least 12 characters. Avoid common or compromised passwords.'],
  password_mismatch: ['İki şifre eşleşmiyor. Lütfen aynı şifreyi tekrar yazın.', 'The passwords do not match. Enter the same password again.'],
  email_address_invalid: ['Geçerli bir e-posta adresi yazın.', 'Enter a valid email address.'],
  email_address_not_authorized: ['E-posta hizmeti bu adrese gönderime izin vermiyor. Site yöneticisinin e-posta gönderim ayarlarını kontrol etmesi gerekiyor.', 'The email service cannot send to this address. The site administrator needs to check the email delivery settings.'],
  over_email_send_rate_limit: ['E-posta gönderim sınırına ulaşıldı. Bir süre sonra yeniden deneyin; gelen kutusu ve gereksiz e-posta klasörünü kontrol edin.', 'The email sending limit has been reached. Try again later and check your inbox and spam folder.'],
  over_request_rate_limit: ['Çok fazla deneme yapıldı. Bir süre bekleyip yeniden deneyin.', 'Too many attempts. Wait a while before trying again.'],
  user_already_exists: ['Bu adres için bir hesap zaten var. Giriş yapın veya şifrenizi sıfırlayın.', 'An account already exists for this address. Sign in or reset your password.'],
  signup_disabled: ['Yeni hesap oluşturma şu anda kapalı. Mevcut hesabınızla giriş yapabilirsiniz.', 'New registrations are currently disabled. You can sign in with an existing account.'],
  email_provider_disabled: ['E-posta ile giriş şu anda kullanılamıyor. Lütfen daha sonra yeniden deneyin.', 'Email sign-in is currently unavailable. Please try again later.'],
  same_password: ['Yeni şifreniz mevcut şifrenizden farklı olmalı.', 'Your new password must be different from the current password.'],
  session_expired: ['Oturumun süresi doldu. Yeniden giriş yapın; bu cihazdaki kayıtlarınız korunuyor.', 'Your session has expired. Sign in again; your local saves are safe.'],
  not_signed_in: ['Bulut kaydı için hesabınıza giriş yapın.', 'Sign in to use cloud saves.'],
  recovery_required: ['Önce e-postadaki şifre sıfırlama bağlantısını açın.', 'Open the password reset link in your email first.'],
  invalid_link: ['Bu bağlantı geçersiz, kullanılmış veya süresi dolmuş. Yeni bir e-posta isteyin.', 'This link is invalid, already used, or expired. Request a new email.'],
  network: ['İnternet bağlantısı kurulamadı. Bağlantınızı kontrol edip yeniden deneyin.', 'Could not connect. Check your internet connection and try again.'],
  timeout: ['İşlem zaman aşımına uğradı. Bağlantınızı kontrol edip yeniden deneyin.', 'The request timed out. Check your connection and try again.'],
  email_delivery: ['E-posta gönderilemedi. Lütfen daha sonra yeniden deneyin. Sorun sürerse site yöneticisi gönderim ayarlarını kontrol etmelidir.', 'The email could not be sent. Try again later. If this continues, the site administrator needs to check delivery settings.'],
  unavailable: ['Bulut hizmetine şu anda ulaşılamıyor. Lütfen daha sonra yeniden deneyin.', 'The cloud service is currently unavailable. Please try again later.'],
  captcha_failed: ['Güvenlik doğrulaması tamamlanamadı. Lütfen yeniden deneyin.', 'The security check could not be completed. Please try again.'],
  conflict: ['Başka cihaz bulut kaydını değiştirdi. Önce güncel bulut sahnesini açın; yerel çalışmanız korunuyor.', 'Another device changed the cloud save. Open the latest cloud scene first; your local work is safe.'],
  no_cloud_scene: ['Henüz bulut kaydı yok.', 'There is no cloud save yet.'],
  invalid_scene: ['Sahne kaydı okunamadı. Bu cihazdaki çalışma korunuyor.', 'The scene could not be read. Your local work is safe.'],
  save_unconfirmed: ['Bulut kayıt onayı alınamadı. Bu cihazdaki kopya korunuyor.', 'The cloud save was not confirmed. Your local copy is safe.'],
  unknown: ['İşlem tamamlanamadı. Lütfen daha sonra yeniden deneyin.', 'The action could not be completed. Please try again later.'],
};

export function cloudErrorMessage(error: unknown, lang: CloudLanguage): string {
  const code = error instanceof CloudError ? error.code : error instanceof TypeError ? 'network' : 'unknown';
  return (messages[code] || messages.unknown)[lang === 'tr' ? 0 : 1];
}

export function providerError(body: any, status: number): CloudError {
  let code = typeof body?.error_code === 'string' ? body.error_code : typeof body?.code === 'string' ? body.code : '';
  // Older GoTrue versions may not provide error_code. Only classify known messages; never display them.
  const legacy = String(body?.msg || body?.message || body?.error_description || '').toLowerCase();
  if (code === '40001') return new CloudConflict();
  if (!code || /^\d+$/.test(code)) {
    if (legacy.includes('invalid login credentials')) code = 'invalid_credentials';
    else if (legacy.includes('email not confirmed')) code = 'email_not_confirmed';
    else if (legacy.includes('error sending')) code = 'email_delivery';
    else if (legacy.includes('email rate limit')) code = 'over_email_send_rate_limit';
    else if (legacy.includes('already registered')) code = 'user_already_exists';
  }
  if (['otp_expired', 'flow_state_expired', 'flow_state_not_found', 'access_denied'].includes(code)) code = 'invalid_link';
  if (['bad_jwt', 'session_not_found', 'refresh_token_not_found', 'refresh_token_already_used', 'user_not_found'].includes(code)) code = 'session_expired';
  if (!messages[code] || code === 'unknown') code = status === 429 ? 'over_request_rate_limit' : status === 401 ? 'session_expired' : status >= 500 ? 'unavailable' : 'unknown';
  return new CloudError(code, status);
}

export function validateNewPassword(password: string, repeat: string): void {
  if (password !== repeat) throw new CloudError('password_mismatch');
  if (password.length < 12) throw new CloudError('weak_password');
}
