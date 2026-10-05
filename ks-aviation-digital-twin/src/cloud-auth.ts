import type { CloudStore } from './cloud-store';
import { authRedirectUrl } from './auth-callback';
import { CloudError, cloudErrorMessage, validateNewPassword, type CloudLanguage } from './cloud-errors';

type Mode = 'signin' | 'signup' | 'verify' | 'forgot' | 'reset';
export type AuthViewState = { mode: Mode; email: string; retryAt: number };
const eye = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';

/** UI only: credentials go exclusively through the existing CloudStore / Supabase Auth. */
export class CloudAuth {
  private busy = false;
  private closed = false;
  private refresh?: () => void;
  private timer?: ReturnType<typeof setInterval>;
  constructor(private host: HTMLElement, private store: CloudStore, private lang: CloudLanguage,
    private state: AuthViewState, private authenticated: (message?: string) => Promise<void>, initialMessage = '') {
    if (store.recovering) state.mode = 'reset';
    this.render(initialMessage);
  }
  destroy() { this.closed = true; if (this.timer) clearInterval(this.timer); }
  private say(tr: string, en: string) { return this.lang === 'tr' ? tr : en; }
  private render(message = '', error = false) {
    if (this.closed) return;
    if (this.timer) clearInterval(this.timer);
    const mode = this.state.mode;
    this.host.replaceChildren();
    this.host.className = 'cloud-auth';
    const nav = document.createElement('div'); nav.className = 'cloud-auth-tabs'; nav.setAttribute('role', 'tablist');
    nav.setAttribute('aria-label', this.say('Hesap işlemleri', 'Account actions'));
    const addButton = (parent: HTMLElement, label: string, action: () => void, className = '') => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.className = className;
      b.onclick = () => { if (!this.busy) action(); }; parent.append(b); return b;
    };
    const switchMode = (next: Mode) => { this.state.mode = next; this.render(); };
    if (mode !== 'reset') {
      for (const [next, label] of [['signin', this.say('Giriş yap', 'Sign in')], ['signup', this.say('Hesap oluştur', 'Create account')]] as const) {
        const b = addButton(nav, label, () => switchMode(next)); b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', String(mode === next));
      }
      this.host.append(nav);
    }
    const heading = document.createElement('h3');
    heading.textContent = ({ signin: this.say('Hesabına giriş yap', 'Sign in to your account'), signup: this.say('Yeni hesap oluştur', 'Create a new account'),
      verify: this.say('E-posta doğrulaması bekleniyor', 'Email verification pending'), forgot: this.say('Şifreni sıfırla', 'Reset your password'), reset: this.say('Yeni şifreni belirle', 'Choose your new password') })[mode];
    const description = document.createElement('p'); description.className = 'cloud-auth-description';
    description.textContent = ({ signin: this.say('Telefon ve bilgisayarda aynı hesabı kullanın.', 'Use the same account on your phone and computer.'),
      signup: this.say('Hesap açtıktan sonra e-postanızdaki doğrulama bağlantısını açın.', 'After registering, open the verification link in your email.'),
      verify: this.say('E-postadaki bağlantıyı açıp bu siteye dönün. Gelen kutusu ve gereksiz e-posta klasörünü kontrol edin. Bu adresle zaten hesabınız varsa giriş yapın veya şifrenizi sıfırlayın.', 'Open the email link to return to this site. Check your inbox and spam folder. If you already have an account, sign in or reset your password.'),
      forgot: this.say('Hesabınızın e-posta adresini yazın. E-postadaki bağlantı yeni şifrenizi belirlemek için bu siteyi açar.', 'Enter your account email. The email link will open this site so you can choose a new password.'),
      reset: this.say('Sıfırlama bağlantısı doğrulandı. Yeni şifrenizi iki alana da yazın.', 'Your reset link was verified. Enter your new password in both fields.') })[mode];
    const status = document.createElement('p'); status.className = 'cloud-auth-status'; status.setAttribute('aria-live', 'polite');
    const setStatus = (text: string, failed = false) => { status.textContent = text; status.hidden = !text; status.dataset.kind = failed ? 'error' : 'info'; status.setAttribute('role', failed ? 'alert' : 'status'); };
    setStatus(message, error); this.host.append(heading, description, status);
    const form = document.createElement('form'); form.className = 'cloud-auth-form'; this.host.append(form);
    const field = (label: string, type: string, autocomplete: string) => {
      const row = document.createElement('label'); row.className = 'cloud-auth-field';
      const caption = document.createElement('span'); caption.textContent = label;
      const wrap = document.createElement('span'); wrap.className = 'cloud-input-wrap';
      const input = document.createElement('input'); input.type = type; input.required = true; input.setAttribute('autocomplete', autocomplete);
      input.setAttribute('aria-label', label); wrap.append(input); row.append(caption, wrap); form.append(row); return { input, wrap };
    };
    let email: HTMLInputElement | undefined;
    if (mode !== 'reset') {
      email = field(this.say('E-posta', 'Email'), 'email', 'username').input; email.value = this.state.email; email.name = 'email';
      email.autocapitalize = 'none'; email.spellcheck = false;
    }
    const password = (repeat: boolean) => {
      const label = repeat ? this.say('Şifre tekrar', 'Confirm password') : mode === 'reset' ? this.say('Yeni şifre', 'New password') : this.say('Şifre', 'Password');
      const { input, wrap } = field(label, 'password', mode === 'signin' ? 'current-password' : 'new-password');
      input.name = repeat ? 'password-confirm' : 'password';
      const show = repeat ? this.say('Şifre tekrarını göster', 'Show confirmation password') : this.say('Şifreyi göster', 'Show password');
      const hide = repeat ? this.say('Şifre tekrarını gizle', 'Hide confirmation password') : this.say('Şifreyi gizle', 'Hide password');
      const toggle = addButton(wrap, '', () => { const visible = input.type === 'password'; input.type = visible ? 'text' : 'password'; toggle.setAttribute('aria-label', visible ? hide : show); toggle.title = visible ? hide : show; toggle.setAttribute('aria-pressed', String(visible)); }, 'cloud-password-toggle');
      toggle.innerHTML = eye; toggle.title = show; toggle.setAttribute('aria-label', show); toggle.setAttribute('aria-pressed', 'false');
      if (mode !== 'signin') input.minLength = 12;
      return input;
    };
    const pass = ['signin', 'signup', 'reset'].includes(mode) ? password(false) : undefined;
    const repeat = ['signup', 'reset'].includes(mode) ? password(true) : undefined;
    const hint = document.createElement('p'); hint.className = 'cloud-password-hint'; hint.setAttribute('aria-live', 'polite');
    if (repeat) form.append(hint);
    const submit = document.createElement('button'); submit.type = 'submit'; submit.className = 'cloud-primary';
    const submitLabel = ({ signin: this.say('Giriş yap', 'Sign in'), signup: this.say('Hesap oluştur', 'Create account'),
      verify: this.say('Doğrulama e-postasını tekrar gönder', 'Resend verification email'), forgot: this.say('Şifre sıfırlama e-postası gönder', 'Send password reset email'), reset: this.say('Yeni şifreyi kaydet', 'Save new password') })[mode];
    form.append(submit);
    const update = () => {
      const remaining = ['verify', 'forgot'].includes(mode) ? Math.max(0, Math.ceil((this.state.retryAt - Date.now()) / 1000)) : 0;
      const matching = !repeat || pass!.value === repeat.value;
      if (repeat) {
        const mismatch = !!repeat.value && !matching;
        hint.textContent = mismatch ? cloudErrorMessage(new CloudError('password_mismatch'), this.lang) : this.say('En az 12 karakter. İki şifre aynı olmalı.', 'At least 12 characters. Both passwords must match.');
        hint.dataset.kind = mismatch ? 'error' : 'info'; repeat.setAttribute('aria-invalid', String(mismatch));
      }
      submit.disabled = this.busy || !!remaining || !matching || !!(repeat && pass!.value.length < 12);
      submit.textContent = this.busy ? this.say('İşlem sürüyor…', 'Working…') : remaining ? `${submitLabel} (${remaining} s)` : submitLabel;
    };
    this.refresh = update;
    form.oninput = () => { if (email) this.state.email = email.value.trim(); update(); };
    const run = async (action: () => Promise<void>) => {
      if (this.busy) return; this.busy = true;
      this.host.setAttribute('aria-busy', 'true');
      this.host.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,button').forEach(el => el.disabled = true);
      setStatus(this.say('İşlem sürüyor…', 'Working…')); update();
      try { await action(); }
      catch (e) {
        if (this.closed) return;
        if (e instanceof CloudError && e.code === 'email_not_confirmed') { this.state.mode = 'verify'; this.render(cloudErrorMessage(e, this.lang), true); }
        else setStatus(cloudErrorMessage(e, this.lang), true);
      } finally {
        this.busy = false; this.host.removeAttribute('aria-busy');
        this.host.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,button').forEach(el => el.disabled = false);
        // render may have changed the mode after an error.
        this.refresh?.();
      }
    };
    form.onsubmit = e => {
      e.preventDefault(); if (this.busy || submit.disabled || !form.reportValidity()) return;
      if (email) this.state.email = email.value.trim();
      void run(async () => {
        const redirect = authRedirectUrl(window.location.href);
        if (mode === 'signin') { await this.store.signIn(this.state.email, pass!.value); pass!.value = ''; await this.authenticated(); }
        else if (mode === 'signup') {
          validateNewPassword(pass!.value, repeat!.value);
          const signedIn = await this.store.signUp(this.state.email, pass!.value, repeat!.value, redirect);
          pass!.value = repeat!.value = '';
          if (signedIn) await this.authenticated();
          else { this.state.retryAt = Date.now() + 60000; this.state.mode = 'verify'; this.render(this.say('Doğrulama gerekiyorsa e-posta gönderim isteği alındı. Bağlantıyı açarak hesabınızı doğrulayın.', 'If verification is required, the email request has been accepted. Open the link to verify your account.')); }
        } else if (mode === 'reset') {
          await this.store.updatePassword(pass!.value, repeat!.value); pass!.value = repeat!.value = '';
          await this.authenticated(this.say('Şifreniz güncellendi. Hesabınız açık.', 'Your password has been updated. You are signed in.'));
        } else {
          if (mode === 'verify') await this.store.resendVerification(this.state.email, redirect);
          else await this.store.requestPasswordReset(this.state.email, redirect);
          this.state.retryAt = Date.now() + 60000;
          setStatus(mode === 'verify' ? this.say('Bu adres doğrulama bekliyorsa yeni bir bağlantı gönderildi. Gelen kutusu ve gereksiz e-posta klasörünü kontrol edin.', 'If this address is awaiting verification, a new link has been sent. Check your inbox and spam folder.') : this.say('Bu adresle bir hesap varsa şifre sıfırlama e-postası gönderildi. Gelen kutusu ve gereksiz e-posta klasörünü kontrol edin.', 'If an account exists for this address, a password reset email has been sent. Check your inbox and spam folder.'));
        }
      });
    };
    const actions = document.createElement('div'); actions.className = 'cloud-auth-links'; this.host.append(actions);
    if (mode === 'signin') {
      addButton(actions, this.say('Şifremi unuttum', 'Forgot password'), () => switchMode('forgot'));
      addButton(actions, this.say('Doğrulama e-postasını tekrar gönder', 'Resend verification email'), () => switchMode('verify'));
    } else if (mode !== 'reset') addButton(actions, this.say('Giriş ekranına dön', 'Back to sign in'), () => switchMode('signin'));
    if (mode === 'verify') addButton(actions, this.say('Şifremi unuttum', 'Forgot password'), () => switchMode('forgot'));
    update();
    if (['verify', 'forgot'].includes(mode)) this.timer = setInterval(update, 1000);
  }
}
