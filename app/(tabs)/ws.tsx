import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';

export default function WebSocketGenerationScreen() {
  const [serverBaseUrl, setServerBaseUrl] = useState<string>('wss://masterwordai.com/test/generation2');
  const [logId, setLogId] = useState<string>('1075');
  const [accessToken, setAccessToken] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connected, setConnected] = useState<boolean>(false);
  const [output, setOutput] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);

  const normalizedBase = useMemo(() => {
    let base = serverBaseUrl.trim().replace(/\/$/, '');
    // Help Android emulator reach host machine
    if (Platform.OS === 'android') {
      base = base
        .replace('ws://localhost', 'ws://10.0.2.2')
        .replace('ws://127.0.0.1', 'ws://10.0.2.2');
    }
    return base;
  }, [serverBaseUrl]);

  const headerAuthorizationValue = useMemo(() => {
    return accessToken || '';
  }, [accessToken]);

  const url = useMemo(() => {
    const trimmedBase = normalizedBase;
    const id = (logId || '').trim();
    if (!id) return '';
    const baseUrl = `${trimmedBase}/${id}`;
    if (Platform.OS === 'web' && headerAuthorizationValue) {
      const qp = new URLSearchParams();
      qp.set('authorization', headerAuthorizationValue);
      // also include legacy param for servers expecting this
      qp.set('accesstoken', headerAuthorizationValue);
      return `${baseUrl}?${qp.toString()}`;
    }
    return baseUrl;
  }, [normalizedBase, logId, headerAuthorizationValue]);

  const appendOutput = useCallback((text: string) => {
    setOutput(prev => prev + text);
  }, []);

  const handleConnect = useCallback(() => {
    if (!url) return;
    // Close any existing connection first
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
    }

    setIsConnecting(true);
    setConnected(false);
    setOutput('');

    try {
      let ws: WebSocket;
      if (Platform.OS !== 'web' && headerAuthorizationValue) {
        const RNWebSocket: any = WebSocket as any;
        ws = new RNWebSocket(url, null, { headers: { Authorization: headerAuthorizationValue } });
      } else {
        ws = new WebSocket(url);
      }

      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnecting(false);
        setConnected(true);
        appendOutput('\n[connected]\n');
      };

      ws.onmessage = (event: WebSocketMessageEvent) => {
        const data = String((event as any).data ?? '');
        if (data === '[END]') {
          try { ws.close(); } catch {}
          setConnected(false);
          return;
        }
        appendOutput(data);
      };

      ws.onerror = () => {
        setIsConnecting(false);
        setConnected(false);
        appendOutput('\n[error] Connection error. Check host/port/firewall.\n');
      };

      ws.onclose = (e: any) => {
        setIsConnecting(false);
        setConnected(false);
        const code = (e && e.code) || '';
        const reason = (e && e.reason) || '';
        appendOutput(`\n[closed] code=${code} reason=${reason}\n`);
      };
    } catch (e) {
      setIsConnecting(false);
      setConnected(false);
      appendOutput('\n[error] Failed to create WebSocket.\n');
    }
  }, [appendOutput, url, headerAuthorizationValue]);

  const handleDisconnect = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
    setConnected(false);
    setIsConnecting(false);
  }, []);

  const handleClear = useCallback(() => setOutput(''), []);

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>Generation Stream</ThemedText>

      <View style={styles.fieldGroup}>
        <ThemedText style={styles.label}>Server WS base</ThemedText>
        <TextInput
          value={serverBaseUrl}
          onChangeText={setServerBaseUrl}
          placeholder="wss://masterwordai.com/test/generation2"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.fieldGroup, styles.rowItem]}>
          <ThemedText style={styles.label}>Log ID</ThemedText>
          <TextInput
            value={logId}
            onChangeText={setLogId}
            placeholder="123"
            keyboardType="number-pad"
            style={styles.input}
          />
        </View>
        <View style={[styles.fieldGroup, styles.rowItem]}>
          <ThemedText style={styles.label}>Authorization header</ThemedText>
          <TextInput
            value={accessToken}
            onChangeText={setAccessToken}
            placeholder={'<token>'}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
        </View>
      </View>

      <View style={styles.buttonsRow}>
        <PrimaryButton
          label={isConnecting ? 'Connecting...' : connected ? 'Connected' : 'Connect'}
          onPress={handleConnect}
          disabled={isConnecting || connected || !url}
        />
        <SecondaryButton label="Disconnect" onPress={handleDisconnect} disabled={!connected && !isConnecting} />
        <SecondaryButton label="Clear" onPress={handleClear} />
      </View>

      <ThemedText style={styles.resolvedUrl}>Resolved URL: {url || '-'}</ThemedText>

      <ThemedText type="subtitle" style={styles.outputTitle}>Output</ThemedText>
      <View style={styles.outputBox}>
        <ScrollView contentContainerStyle={styles.outputScroll}>
          <ThemedText style={styles.mono}>{output || '...'}</ThemedText>
        </ScrollView>
      </View>
    </ThemedView>
  );
}

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!!disabled}
      style={[styles.button, styles.primary, disabled ? styles.buttonDisabled : undefined]}
    >
      <ThemedText style={styles.buttonText}>{label}</ThemedText>
    </TouchableOpacity>
  );
}

function SecondaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!!disabled}
      style={[styles.button, styles.secondary, disabled ? styles.buttonDisabled : undefined]}
    >
      <ThemedText style={[styles.buttonText, styles.secondaryText]}>{label}</ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  title: {
    marginBottom: 4,
  },
  fieldGroup: {
    gap: 6,
    marginBottom: 8,
  },
  label: {
    opacity: 0.8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowItem: {
    flex: 1,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primary: {
    backgroundColor: Colors.light.tint,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#888',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontWeight: '600',
  },
  secondaryText: {
    color: '#888',
  },
  outputTitle: {
    marginTop: 8,
  },
  outputBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    padding: 12,
  },
  outputScroll: {
    paddingBottom: 120,
  },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string,
  },
  resolvedUrl: {
    opacity: 0.7,
  },
  hint: {
    opacity: 0.6,
    fontSize: 12,
  },
});


