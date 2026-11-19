import React from 'react';
import { HttpErrorCode } from '../data/errorPagesData';
import { LegalPageSlug } from '../data/legalPagesData';
import { ToolFilterType } from '../types/tools';
import { HttpErrorPage } from './HttpErrorPage';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
  resetKey?: string | number;
  onGoHome: () => void;
  onExploreAllTools: (filter?: ToolFilterType) => void;
  onOpenCalculator: () => void;
  onOpenSearch: () => void;
  onOpenLegalPage: (slug: LegalPageSlug) => void;
  onOpenSitemap?: () => void;
  onSelectErrorCode?: (code: HttpErrorCode) => void;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected rendering error occurred.',
    };
  }

  componentDidUpdate(prevProps: AppErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, errorMessage: '' });
    }
  }

  private handleResetAndRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      const currentPath =
        typeof window !== 'undefined'
          ? window.location.pathname + window.location.search
          : '/500';
      return (
        <HttpErrorPage
          statusCode={500}
          requestedPath={currentPath}
          errorDetail={this.state.errorMessage}
          onRetry={this.handleResetAndRetry}
          onGoHome={() => {
            this.handleResetAndRetry();
            this.props.onGoHome();
          }}
          onExploreAllTools={(filter) => {
            this.handleResetAndRetry();
            this.props.onExploreAllTools(filter);
          }}
          onOpenCalculator={() => {
            this.handleResetAndRetry();
            this.props.onOpenCalculator();
          }}
          onOpenSearch={() => {
            this.handleResetAndRetry();
            this.props.onOpenSearch();
          }}
          onOpenLegalPage={(slug) => {
            this.handleResetAndRetry();
            this.props.onOpenLegalPage(slug);
          }}
          onOpenSitemap={
            this.props.onOpenSitemap
              ? () => {
                  this.handleResetAndRetry();
                  this.props.onOpenSitemap?.();
                }
              : undefined
          }
          onSelectErrorCode={
            this.props.onSelectErrorCode
              ? (code) => {
                  this.handleResetAndRetry();
                  this.props.onSelectErrorCode?.(code);
                }
              : undefined
          }
        />
      );
    }

    return this.props.children;
  }
}
