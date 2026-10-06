import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export default function LoginView() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // App.jsx will automatically detect the state change
    } catch (err) {
      console.error(err);
      setError("Email ou senha incorretos.");
      setLoading(false);
    }
  };

  return (
    <div className="app-container login-view" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="glass-card text-center" style={{ padding: '2rem 1.5rem' }}>
        <div className="logo-icon" style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚡</div>
        <h1 style={{ marginBottom: '0.5rem' }}>Login</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Acesso restrito. Utilize a mesma conta do sistema principal.
        </p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          <input 
            type="email" 
            className="poste-input" 
            placeholder="Seu E-mail" 
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input 
            type="password" 
            className="poste-input" 
            placeholder="Sua Senha" 
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
