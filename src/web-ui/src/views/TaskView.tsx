import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedPanel } from '../components/ui/AnimatedPanel';
import { StatusBadge } from '../components/ui/StatusBadge';

interface ClarifyingQuestion {
  id: string;
  question: string;
  options: string[];
  selectedOption?: string;
}

interface TaskHistoryItem {
  id: string;
  content: string;
  status: 'running' | 'completed' | 'failed' | 'pending';
  timestamp: Date;
  language: 'en' | 'ar';
}

const MOCK_QUESTIONS: ClarifyingQuestion[] = [
  {
    id: 'q1',
    question: 'What testing framework should be used?',
    options: ['Vitest', 'Jest', 'Mocha'],
  },
  {
    id: 'q2',
    question: 'Should the implementation include error handling?',
    options: ['Yes, comprehensive', 'Basic only', 'Skip for now'],
  },
];

const MOCK_HISTORY: TaskHistoryItem[] = [
  { id: '1', content: 'Implement authentication module with OAuth2 support', status: 'completed', timestamp: new Date(Date.now() - 3600000), language: 'en' },
  { id: '2', content: 'Add real-time WebSocket notifications', status: 'running', timestamp: new Date(Date.now() - 1800000), language: 'en' },
  { id: '3', content: 'Refactor database connection pooling', status: 'failed', timestamp: new Date(Date.now() - 7200000), language: 'en' },
  { id: '4', content: 'Create unit tests for payment processing', status: 'pending', timestamp: new Date(Date.now() - 900000), language: 'en' },
  { id: '5', content: 'تحسين أداء واجهة المستخدم', status: 'completed', timestamp: new Date(Date.now() - 5400000), language: 'ar' },
];

const RTL_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function TaskView() {
  const { t } = useTranslation('common');
  const [taskInput, setTaskInput] = useState('');
  const [language, setLanguage] = useState<'en' | 'ar'>('en');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>(MOCK_QUESTIONS);
  const [history] = useState<TaskHistoryItem[]>(MOCK_HISTORY);

  const isRTL = language === 'ar';
  const detectedRTL = RTL_REGEX.test(taskInput);

  const handleSubmit = useCallback(() => {
    if (!taskInput.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setTimeout(() => setIsSubmitting(false), 2000);
  }, [taskInput, isSubmitting]);

  const handleQuestionAnswer = (questionId: string, option: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, selectedOption: option } : q))
    );
  };

  const formatTimestamp = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="space-y-6">
      <AnimatedPanel variant="slideUp" duration={0.4}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">{t('navigation.tasks')}</h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-dark-tertiary rounded-lg p-0.5">
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-fast ${
                  language === 'en'
                    ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/20'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('ar')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-fast ${
                  language === 'ar'
                    ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/20'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                AR
              </button>
            </div>
          </div>
        </div>
      </AnimatedPanel>

      {/* Task Input Area */}
      <AnimatedPanel variant="slideUp" delay={0.1}>
        <div className="glass-panel p-6">
          <div className="relative">
            <textarea
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value.slice(0, 10000))}
              dir={isRTL || detectedRTL ? 'rtl' : 'ltr'}
              placeholder={
                isRTL
                  ? 'أدخل وصف المهمة هنا...'
                  : 'Describe your task in detail...'
              }
              rows={6}
              className={`
                w-full bg-dark-primary border border-dark-tertiary rounded-xl p-4 
                text-text-primary placeholder:text-text-muted resize-none
                focus:outline-none focus:border-accent-primary/60 focus:ring-2 focus:ring-accent-primary/20
                focus:shadow-[0_0_20px_rgba(59,130,246,0.15)]
                transition-all duration-normal
                font-sans text-sm leading-relaxed
              `}
            />
            <div className="absolute bottom-3 end-3 flex items-center gap-3">
              <span className={`text-xs font-mono ${taskInput.length > 9500 ? 'text-status-failed' : 'text-text-muted'}`}>
                {taskInput.length.toLocaleString()} / 10,000
              </span>
              {detectedRTL && language === 'en' && (
                <span className="text-xs text-accent-secondary bg-accent-secondary/10 px-2 py-0.5 rounded-full">
                  RTL detected
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-text-muted">
              {isRTL ? 'يدعم تنسيق Markdown' : 'Supports Markdown formatting'}
            </p>
            <motion.button
              onClick={handleSubmit}
              disabled={!taskInput.trim() || isSubmitting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`
                px-6 py-2.5 rounded-lg text-sm font-semibold
                transition-all duration-fast
                ${
                  isSubmitting
                    ? 'bg-accent-primary/50 text-white/70 cursor-wait'
                    : taskInput.trim()
                    ? 'bg-accent-primary hover:bg-accent-hover text-white shadow-lg shadow-accent-primary/25 hover:shadow-accent-primary/40'
                    : 'bg-dark-tertiary text-text-muted cursor-not-allowed'
                }
              `}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {isRTL ? 'جاري الإرسال...' : 'Submitting...'}
                </span>
              ) : (
                isRTL ? 'إرسال المهمة' : 'Submit Task'
              )}
            </motion.button>
          </div>
        </div>
      </AnimatedPanel>

      {/* Clarifying Questions */}
      <AnimatePresence>
        {questions.length > 0 && (
          <AnimatedPanel variant="slideUp" delay={0.2}>
            <div className="glass-panel p-5">
              <h2 className="text-sm font-semibold text-accent-secondary mb-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Clarifying Questions
              </h2>
              <div className="space-y-4">
                {questions.map((q) => (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="border-s-2 border-accent-primary/40 ps-4"
                  >
                    <p className="text-sm text-text-primary mb-2">{q.question}</p>
                    <div className="flex flex-wrap gap-2">
                      {q.options.map((option) => (
                        <button
                          key={option}
                          onClick={() => handleQuestionAnswer(q.id, option)}
                          className={`
                            px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-fast
                            ${
                              q.selectedOption === option
                                ? 'bg-accent-primary text-white shadow-md shadow-accent-primary/20'
                                : 'bg-dark-tertiary text-text-secondary hover:text-text-primary hover:bg-dark-tertiary/80 border border-dark-tertiary hover:border-accent-primary/30'
                            }
                          `}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </AnimatedPanel>
        )}
      </AnimatePresence>

      {/* Task History */}
      <AnimatedPanel variant="slideUp" delay={0.3}>
        <div className="glass-panel p-5">
          <h2 className="text-sm font-semibold text-text-secondary mb-4">Task History</h2>
          <div className="space-y-2">
            {history.map((task, index) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-lg bg-dark-primary/50 hover:bg-dark-primary border border-transparent hover:border-dark-tertiary transition-all duration-fast cursor-pointer group"
              >
                <div className="flex-1 min-w-0">
                  <p
                    dir={task.language === 'ar' ? 'rtl' : 'ltr'}
                    className="text-sm text-text-primary truncate group-hover:text-accent-hover transition-colors"
                  >
                    {task.content}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={task.status} size="sm" pulse={task.status === 'running'} />
                  <span className="text-xs text-text-muted font-mono whitespace-nowrap">
                    {formatTimestamp(task.timestamp)}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedPanel>
    </div>
  );
}
