import { useState } from 'react'
import { apiAskAnalyticsAgent } from '../../lib/api.js'

const SUGGESTIONS = [
  'Which item did I spend the most on in the last 2 weeks?',
  'Which items have I been buying every month?',
  'What changed in my spending this month?',
]

export default function AnalystAgent() {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const askQuestion = async (nextQuestion = question) => {
    const trimmedQuestion = nextQuestion.trim()
    if (!trimmedQuestion || loading) return

    setQuestion('')
    setError(null)
    setMessages((current) => [...current, { role: 'user', content: trimmedQuestion }])
    setLoading(true)

    try {
      const answer = await apiAskAnalyticsAgent(trimmedQuestion)
      setMessages((current) => [...current, { role: 'assistant', content: answer }])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    askQuestion()
  }

  return (
    <section className="analyst-agent" aria-labelledby="analyst-agent-heading">
      <div className="analyst-agent-header">
        <div>
          <span className="analyst-agent-mark" aria-hidden="true">V</span>
          <div>
            <h3 id="analyst-agent-heading">Ask your spending analyst</h3>
            <p>Get a quick, plain-language read on what your numbers mean.</p>
          </div>
        </div>
        <span className="analyst-agent-status">Ready</span>
      </div>

      {messages.length === 0 && (
        <div className="analyst-agent-welcome">
          <p>Try asking about a trend, vendor, category, or the biggest opportunity to review.</p>
          <div className="analyst-suggestions" aria-label="Suggested questions">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => askQuestion(suggestion)}
                disabled={loading}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div className="analyst-conversation" aria-live="polite">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`analyst-message analyst-message-${message.role}`}>
              <span>{message.role === 'user' ? 'You' : 'Vantage Analyst'}</span>
              <p>{message.content}</p>
            </div>
          ))}
          {loading && <p className="analyst-thinking">Reviewing your spending...</p>}
        </div>
      )}

      {error && <p className="analyst-error" role="alert">{error}</p>}

      <form className="analyst-input-row" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="analyst-question">Ask about your spending</label>
        <input
          id="analyst-question"
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about your expenses..."
          maxLength={500}
          disabled={loading}
        />
        <button type="submit" className="wb-button-primary" disabled={loading || !question.trim()}>
          {loading ? 'Thinking...' : 'Ask'}
        </button>
      </form>
    </section>
  )
}
