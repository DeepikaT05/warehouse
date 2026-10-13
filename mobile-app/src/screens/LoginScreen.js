import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Image, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { COLORS } from '../theme';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../services/api';

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    const u = username.trim();
    const p = password.trim();
    if (!u || !p) {
      setError('Enter your username and password.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      // On success the root navigator swaps to the app stack on its own.
      await login(u, p);
    } catch (err) {
      setError(errorMessage(err, 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.centre}>
        <View style={styles.card}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>VANIKI STOCK TRACE</Text>
          <Text style={styles.subtitle}>Warehouse Scanner</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              placeholder="Enter username"
              placeholderTextColor={COLORS.slate400}
              editable={!loading}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passContainer}>
              <TextInput
                style={[styles.input, styles.passInput]}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                returnKeyType="go"
                onSubmitEditing={handleLogin}
                placeholder="Enter password"
                placeholderTextColor={COLORS.slate400}
                editable={!loading}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Text style={styles.eyeText}>{showPassword ? 'HIDE' : 'SHOW'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.buttonText}>Login</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primary },
  centre: { flex: 1, justifyContent: 'center', padding: 20 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8
  },
  logo: { width: 80, height: 80, borderRadius: 20, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '900', color: COLORS.slate900, letterSpacing: 0.5 },
  subtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 2,
    marginBottom: 20,
    textTransform: 'uppercase'
  },
  formGroup: { width: '100%', marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.slate700, marginBottom: 4 },
  input: {
    backgroundColor: COLORS.slate100,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.slate900,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  passContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.slate100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingRight: 10
  },
  passInput: { flex: 1, borderWidth: 0, backgroundColor: 'transparent' },
  eyeBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  eyeText: { fontSize: 11, fontWeight: '800', color: COLORS.primary },
  error: {
    width: '100%',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '700',
    padding: 10,
    marginBottom: 4
  },
  button: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    minHeight: 48,
    justifyContent: 'center'
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#FFF', fontSize: 14, fontWeight: '800' }
});
