import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from '../ui/Button';
import { theme } from '../ui/theme';
import { UpdateRequiredPrompt } from '../ui/UpdateRequiredPrompt';
import { useAppVersionStore } from '../store/app-version-store';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const err = this.state.error as any;
      const isVersionUnsupported =
        err?.status === 426 ||
        err?.code === 'APP_VERSION_UNSUPPORTED' ||
        err?.message?.includes('APP_VERSION_UNSUPPORTED') ||
        err?.message?.includes('update required');

      if (isVersionUnsupported) {
        return (
          <UpdateRequiredPrompt
            minVersion={err?.minVersion || useAppVersionStore.getState().minVersion}
            onRetry={() => this.setState({ hasError: false, error: null })}
          />
        );
      }

      return (
        <View style={styles.container}>
          <Text style={styles.title}>APPLICATION ERROR</Text>
          <Text style={styles.message}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </Text>
          <Button 
            title="TRY AGAIN" 
            onPress={() => this.setState({ hasError: false, error: null })} 
            variant="primary"
            style={styles.retryBtn}
          />
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.base,
    backgroundColor: theme.colors.surface,
  },
  title: {
    fontFamily: theme.typography.monoBold,
    fontSize: 16,
    color: theme.colors.error,
    marginBottom: theme.spacing.sm,
    letterSpacing: 0.8,
  },
  message: {
    fontFamily: theme.typography.interRegular,
    fontSize: 13,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    lineHeight: 18,
  },
  retryBtn: {
    minWidth: 160,
  },
});
