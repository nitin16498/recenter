import { Component } from 'react'

// Contains a render error to one part of the page instead of unmounting the
// whole app (which leaves a blank screen). `onError` lets the parent react,
// e.g. close the task modal and show a message.
export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    console.error('Recenter UI error:', error, info.componentStack)
    this.props.onError?.(error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
