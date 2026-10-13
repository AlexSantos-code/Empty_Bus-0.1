'use strict';

/**
 * Painel de Ônibus - autenticação (cadastro, login, sessão)
 *
 * ATENÇÃO: esta é uma implementação 100% no navegador (localStorage), útil para
 * protótipo/demonstração. Não existe segurança real sem um servidor: quando houver
 * backend, troque register()/login() por chamadas fetch() à sua API.
 * As senhas nunca são guardadas em texto puro (PBKDF2 + salt aleatório).
 */
const Auth = (() => {
  const USERS_KEY = 'painel:usuarios';
  const SESSION_KEY = 'painel:sessao';
  const LOGIN_PAGE = 'login.html';
  const HOME_PAGE = 'index.html';

  // ---------- Armazenamento seguro (try/catch) ----------
  const read = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  const write = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  };

  // ---------- Utilitários ----------
  const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const toHex = (buf) =>
    [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const fromHex = (hex) =>
    new Uint8Array(hex.match(/.{2}/g).map((h) => parseInt(h, 16)));

  async function hashPassword(password, saltHex) {
    const salt = saltHex
      ? fromHex(saltHex)
      : crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      key,
      256
    );
    return { hash: toHex(bits), salt: toHex(salt) };
  }

  // ---------- Validação ----------
  function validateRegistration({ name, email, password, confirm }) {
    const errors = {};
    if (!String(name || '').trim() || String(name).trim().length < 2)
      errors.name = 'Informe seu nome (mínimo 2 letras).';
    if (!EMAIL_RE.test(normalizeEmail(email))) errors.email = 'Informe um e-mail válido.';
    if (!password || password.length < 8)
      errors.password = 'A senha deve ter pelo menos 8 caracteres.';
    else if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
      errors.password = 'Use letras e números na senha.';
    if (password !== confirm) errors.confirm = 'As senhas não coincidem.';
    return errors;
  }

  // ---------- Operações ----------
  async function register({ name, email, password, confirm }) {
    const errors = validateRegistration({ name, email, password, confirm });
    if (Object.keys(errors).length) return { ok: false, errors };

    const users = read(USERS_KEY, []);
    const mail = normalizeEmail(email);
    if (users.some((u) => u.email === mail))
      return { ok: false, errors: { email: 'Este e-mail já está cadastrado.' } };

    const { hash, salt } = await hashPassword(password);
    users.push({
      id: crypto.randomUUID(),
      name: String(name).trim(),
      email: mail,
      hash,
      salt,
      createdAt: Date.now(),
    });
    if (!write(USERS_KEY, users))
      return { ok: false, errors: { form: 'Não foi possível salvar o cadastro neste navegador.' } };

    return { ok: true };
  }

  async function login({ email, password, remember }) {
    const mail = normalizeEmail(email);
    if (!EMAIL_RE.test(mail) || !password)
      return { ok: false, errors: { form: 'Informe e-mail e senha.' } };

    const user = read(USERS_KEY, []).find((u) => u.email === mail);
    // Mesma mensagem para e-mail inexistente ou senha errada (não revela qual existe)
    const invalid = { ok: false, errors: { form: 'E-mail ou senha incorretos.' } };
    if (!user) {
      await hashPassword(password); // equaliza o tempo de resposta
      return invalid;
    }
    const { hash } = await hashPassword(password, user.salt);
    if (hash !== user.hash) return invalid;

    const session = { id: user.id, name: user.name, email: user.email, at: Date.now() };
    // "Lembrar de mim" -> localStorage; caso contrário -> sessionStorage
    try {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      return { ok: false, errors: { form: 'Não foi possível iniciar a sessão neste navegador.' } };
    }
    return { ok: true, user: session };
  }

  function currentUser() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function logout() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignora */
    }
    window.location.replace(LOGIN_PAGE);
  }

  /** Chame nas páginas privadas: redireciona para o login se não houver sessão. */
  function requireLogin() {
    const user = currentUser();
    if (!user) {
      window.location.replace(LOGIN_PAGE);
      return null;
    }
    return user;
  }

  /** Chame na página de login: se já estiver logado, vai para a home. */
  function redirectIfLoggedIn() {
    if (currentUser()) window.location.replace(HOME_PAGE);
  }

  return { register, login, logout, currentUser, requireLogin, redirectIfLoggedIn, HOME_PAGE };
})();
