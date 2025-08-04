import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import posthog from 'posthog-js'

interface PostHogContextType {
  posthog: typeof posthog | null
  isLoaded: boolean
}

const PostHogContext = createContext<PostHogContextType>({ 
  posthog: null, 
  isLoaded: false 
})

export const usePostHog = () => {
  const context = useContext(PostHogContext)
  return context.posthog
}

export const usePostHogLoaded = () => {
  const context = useContext(PostHogContext)
  return context.isLoaded
}

interface PostHogProviderProps {
  children: ReactNode
}

export const PostHogProvider = ({ children }: PostHogProviderProps) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [phConfig, setPhConfig] = useState<{ posthogKey?: string, posthogHost?: string } | null>(null)

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/config')
        const data = await res.json()
        setPhConfig({ posthogKey: data.posthogKey, posthogHost: data.posthogHost })
        setIsLoaded(true)
        console.log('🔍 Manual fetch config:', data)
      } catch (err) {
        setIsLoaded(true)
        setPhConfig(null)
        console.error('🔍 Error fetching config:', err)
      }
    }
    fetchConfig()
  }, [])

  if (isLoaded && phConfig?.posthogKey) {
    const options = {
      api_host: phConfig.posthogHost || 'https://us.i.posthog.com',
    }
    return (
      <PostHogContext.Provider value={{ posthog: posthog, isLoaded }}>
        <PHProvider 
          apiKey={phConfig.posthogKey}
          options={options}
        >
          {children}
        </PHProvider>
      </PostHogContext.Provider>
    )
  }

  return (
    <PostHogContext.Provider value={{ posthog: null, isLoaded }}>
      {children}
    </PostHogContext.Provider>
  )
}

export default PostHogProvider 
