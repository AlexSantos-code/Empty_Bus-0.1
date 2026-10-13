'use strict';

/** Painel de Ônibus - tela de login/cadastro */
(() => {
  Auth.redirectIfLoggedIn();

  const $ = (sel, root = document) => root.querySelector(sel);
  const tabLogin = $('#tab-login');
  const tabRegister = $('#tab-register');
  const formLogin = $('#form-login');
  const formRegister = $('#form-register');
  const message = $('#auth-message');

  // ---------- Abas ----------
  function showTab(which) {
    const isLogin = which === 'login';
    tabLogin.classList.toggle('active', isLogin);
    tabRegister.classList.toggle('active', !isLogin);
    tabLogin.setAttribute('aria-selected', String(isLogin));
    tabRegister.setAttribute('aria-selected', String(!isLogin));
    formLogin.hidden = !isLogin;
    formRegister.hidden = isLogin;
    clearErrors(formLogin);
    clearErrors(formRegister);
    if (isLogin === false) message.hidden = true;
  }
  tabLogin.addEventListener('click', () => showTab('login'));
  tabRegister.addEventListener('click', () => showTab('register'));

  // ---------- Erros ----------
  function clearErrors(form) {
    form.querySelectorAll('[data-error-for]').forEach((n) => (n.textContent = ''));
    form.querySelectorAll('.field').forEach((f) => f.classList.remove('invalid'));
  }

  function showErrors(form, errors = {}) {
    clearErrors(form);
    Object.entries(errors).forEach(([field, text]) => {
      const target = form.querySelector(`[data-error-for="${field}"]`);
      if (target) target.textContent = text;
      const input = form.querySelector(`[name="${field}"]`);
      if (input) input.closest('.field')?.classList.add('invalid');
    });
    const first = form.querySelector('.field.invalid input');
    if (first) first.focus();
  }

  // ---------- Mostrar/ocultar senha ----------
  document.querySelectorAll('.toggle-pass').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
      btn.firstElementChild.className = show ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
    });
  });

  // ---------- Envio ----------
  async function withLoading(form, fn) {
    const btn = $('.submit-btn', form);
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Aguarde...';
    try {
      await fn();
    } catch (err) {
      console.error(err);
      showErrors(form, { form: 'Ocorreu um erro inesperado. Tente novamente.' });
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  formLogin.addEventListener('submit', (e) => {
    e.preventDefault();
    withLoading(formLogin, async () => {
      const data = new FormData(formLogin);
      const result = await Auth.login({
        email: data.get('email'),
        password: data.get('password'),
        remember: data.get('remember') === 'on',
      });
      if (!result.ok) return showErrors(formLogin, result.errors);
      window.location.replace(Auth.HOME_PAGE);
    });
  });

  formRegister.addEventListener('submit', (e) => {
    e.preventDefault();
    withLoading(formRegister, async () => {
      const data = new FormData(formRegister);
      const result = await Auth.register({
        name: data.get('name'),
        email: data.get('email'),
        password: data.get('password'),
        confirm: data.get('confirm'),
      });
      if (!result.ok) return showErrors(formRegister, result.errors);

      const email = data.get('email');
      formRegister.reset();
      showTab('login');
      $('#login-email').value = String(email).trim();
      message.textContent = 'Conta criada com sucesso! Entre com seu e-mail e senha.';
      message.hidden = false;
      $('#login-password').focus();
    });
  });

  // Se o navegador não suportar Web Crypto (ex.: página aberta fora de HTTPS/localhost)
  if (!window.crypto || !crypto.subtle || !crypto.randomUUID) {
    message.textContent =
      'Este navegador/contexto não suporta criptografia. Abra a página via localhost ou HTTPS.';
    message.style.background = '#FDECEA';
    message.style.color = '#B3261E';
    message.hidden = false;
  }
})();
