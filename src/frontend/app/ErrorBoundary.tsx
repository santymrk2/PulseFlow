import { Component } from "react"
import type { ErrorInfo, ReactNode } from "react"
import styles from "./ErrorBoundary.module.css"

interface ErrorBoundaryProps {
    children: ReactNode
    onReset?: () => void
}

interface ErrorBoundaryState {
    error: Error | null
}

// única clase del proyecto: React no ofrece error boundaries con hooks
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { error: null }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("[ErrorBoundary]", error, info.componentStack)
    }

    reset = () => {
        this.props.onReset?.()
        this.setState({ error: null })
    }

    render() {
        const { error } = this.state
        if (!error) return this.props.children

        return (
            <div className={styles.panel} role="alert">
                <h2 className={styles.title}>Algo salió mal</h2>
                <pre className={styles.message}>{error.message}</pre>
                <div className={styles.actions}>
                    <button onClick={this.reset}>Reintentar</button>
                    <button onClick={() => location.reload()}>Recargar</button>
                </div>
            </div>
        )
    }
}
