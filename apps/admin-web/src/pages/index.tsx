import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const IndexPage = () => {
  return (
    <main className="min-h-screen bg-surface-50 px-6 py-10 text-ink-900">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center">
        <Card className="w-full p-8 shadow-panel">
          <div className="flex max-w-2xl flex-col gap-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-ui bg-accent-100 text-accent-600">
              <Sparkles aria-hidden="true" size={24} />
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-normal text-ink-900 sm:text-4xl">
                AI App Ready
              </h1>
              <p className="text-base leading-7 text-ink-700">
                Start building from this deploy-safe React, Vite, TypeScript, and Tailwind scaffold.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button>Primary Action</Button>
              <Button variant="secondary">Secondary Action</Button>
            </div>
          </div>
        </Card>
      </section>
    </main>
  )
}

export default IndexPage
