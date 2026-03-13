import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import './App.css'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type BodyPart =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Arms'
  | 'Legs'
  | 'Core'
  | 'Cardio'

type ExerciseLog = {
  id: number
  exercise: string
  bodyPart: BodyPart
  weight: number
  reps: number
  sets: number
  duration: number
  speed?: number
  incline?: number
}

type WorkoutEntry = ExerciseLog & {
  date: string
}

type SessionSummary = {
  date: string
  duration: number
  volume: number
  bodyLoad: Record<BodyPart, number>
}

type CalendarMetric = 'duration' | 'volume'
type CalendarStyle = 'heat' | 'photo'
type MobileScreen = 'home' | 'recorder' | 'visuals' | 'calendar'

const BODY_PARTS: BodyPart[] = [
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Legs',
  'Core',
  'Cardio',
]

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const DEMO_SESSION_FINGERPRINTS = new Set([
  '2026-03-02|53|7100',
  '2026-03-05|60|8300',
  '2026-03-08|49|6400',
  '2026-03-10|67|9200',
])

const isDemoSession = (session: SessionSummary) =>
  DEMO_SESSION_FINGERPRINTS.has(`${session.date}|${session.duration}|${session.volume}`)

const stripDemoSessions = (sessions: SessionSummary[]) =>
  sessions.filter((session) => !isDemoSession(session))

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const formatSeconds = (seconds: number) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

const dateKey = (date: Date) => date.toISOString().slice(0, 10)
const monthKey = (date: Date) => date.toISOString().slice(0, 7)

const STORAGE_KEYS = {
  sessions: 'gymup.sessions',
  workoutEntries: 'gymup.workoutEntries',
  logs: 'gymup.logs',
  photosByDate: 'gymup.photosByDate',
  calendarMetric: 'gymup.calendarMetric',
  calendarStyle: 'gymup.calendarStyle',
  selectedDate: 'gymup.selectedDate',
  weeklyGoalBase: 'gymup.weeklyGoal',
  volumeGoalBase: 'gymup.volumeGoal',
} as const

const monthlyStorageKey = (baseKey: string, month: string) => `${baseKey}.${month}`

const loadJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return fallback
    }
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const loadCalendarMetric = (): CalendarMetric => {
  const saved = window.localStorage.getItem(STORAGE_KEYS.calendarMetric)
  return saved === 'volume' ? 'volume' : 'duration'
}

const loadCalendarStyle = (): CalendarStyle => {
  const saved = window.localStorage.getItem(STORAGE_KEYS.calendarStyle)
  return saved === 'photo' ? 'photo' : 'heat'
}

const loadGoal = (key: string, defaultValue: number, min: number, max: number) => {
  const saved = Number(window.localStorage.getItem(key))
  if (!Number.isFinite(saved)) {
    return defaultValue
  }
  return clamp(Math.round(saved), min, max)
}

const parseGoalInput = (value: string, fallback: number, min: number, max: number) => {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return fallback
  }
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return clamp(Math.round(parsed), min, max)
}

const parseIntegerInput = (value: string, fallback: number, min: number, max: number) => {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return fallback
  }
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return clamp(Math.round(parsed), min, max)
}

const parseDecimalInput = (value: string, fallback: number, min: number, max: number) => {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return fallback
  }
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return clamp(parsed, min, max)
}

function App() {
  const currentMonthKey = monthKey(new Date())

  const [isSessionActive, setIsSessionActive] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [logs, setLogs] = useState<ExerciseLog[]>(() =>
    loadJson<ExerciseLog[]>(STORAGE_KEYS.logs, []),
  )
  const [workoutEntries, setWorkoutEntries] = useState<WorkoutEntry[]>(() =>
    loadJson<WorkoutEntry[]>(STORAGE_KEYS.workoutEntries, []),
  )
  const [sessions, setSessions] = useState<SessionSummary[]>(() =>
    stripDemoSessions(loadJson<SessionSummary[]>(STORAGE_KEYS.sessions, [])),
  )

  const [exercise, setExercise] = useState('Bench Press')
  const [bodyPart, setBodyPart] = useState<BodyPart>('Chest')
  const [weight, setWeight] = useState<number>(40)
  const [reps, setReps] = useState<number>(10)
  const [sets, setSets] = useState<number>(3)
  const [duration, setDuration] = useState<number>(12)
  const [speed, setSpeed] = useState<number>(8)
  const [incline, setIncline] = useState<number>(3)
  const [weightDraft, setWeightDraft] = useState<string>('40')
  const [repsDraft, setRepsDraft] = useState<string>('10')
  const [setsDraft, setSetsDraft] = useState<string>('3')
  const [durationDraft, setDurationDraft] = useState<string>('12')
  const [speedDraft, setSpeedDraft] = useState<string>('8')
  const [inclineDraft, setInclineDraft] = useState<string>('3')
  const [calendarMetric, setCalendarMetric] = useState<CalendarMetric>(loadCalendarMetric)
  const [calendarStyle, setCalendarStyle] = useState<CalendarStyle>(loadCalendarStyle)
  const [expandedDate, setExpandedDate] = useState<string | null>(null)
  const [photosByDate, setPhotosByDate] = useState<Record<string, string>>(() =>
    loadJson<Record<string, string>>(STORAGE_KEYS.photosByDate, {}),
  )
  const [selectedDate, setSelectedDate] = useState<string>(
    () => window.localStorage.getItem(STORAGE_KEYS.selectedDate) ?? dateKey(new Date()),
  )
  const [mobileScreen, setMobileScreen] = useState<MobileScreen>('home')
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState<boolean>(() => {
    const displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches
    const iosStandalone =
      typeof (window.navigator as Navigator & { standalone?: boolean }).standalone === 'boolean' &&
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
    return displayModeStandalone || iosStandalone
  })
  const [weeklyGoal, setWeeklyGoal] = useState<number>(() =>
    loadGoal(monthlyStorageKey(STORAGE_KEYS.weeklyGoalBase, currentMonthKey), 4, 1, 14),
  )
  const [volumeGoal, setVolumeGoal] = useState<number>(() =>
    loadGoal(monthlyStorageKey(STORAGE_KEYS.volumeGoalBase, currentMonthKey), 9000, 1000, 50000),
  )
  const [weeklyGoalDraft, setWeeklyGoalDraft] = useState<string>(() => String(weeklyGoal))
  const [volumeGoalDraft, setVolumeGoalDraft] = useState<string>(() => String(volumeGoal))
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const nextWeeklyGoal = loadGoal(
      monthlyStorageKey(STORAGE_KEYS.weeklyGoalBase, currentMonthKey),
      4,
      1,
      14,
    )
    const nextVolumeGoal = loadGoal(
      monthlyStorageKey(STORAGE_KEYS.volumeGoalBase, currentMonthKey),
      9000,
      1000,
      50000,
    )

    setWeeklyGoal(nextWeeklyGoal)
    setVolumeGoal(nextVolumeGoal)
  }, [currentMonthKey])

  useEffect(() => {
    window.localStorage.setItem(
      monthlyStorageKey(STORAGE_KEYS.weeklyGoalBase, currentMonthKey),
      String(weeklyGoal),
    )
  }, [weeklyGoal, currentMonthKey])

  useEffect(() => {
    setWeeklyGoalDraft(String(weeklyGoal))
  }, [weeklyGoal])

  useEffect(() => {
    window.localStorage.setItem(
      monthlyStorageKey(STORAGE_KEYS.volumeGoalBase, currentMonthKey),
      String(volumeGoal),
    )
  }, [volumeGoal, currentMonthKey])

  useEffect(() => {
    setVolumeGoalDraft(String(volumeGoal))
  }, [volumeGoal])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(logs))
  }, [logs])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.workoutEntries, JSON.stringify(workoutEntries))
  }, [workoutEntries])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(sessions))
  }, [sessions])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.photosByDate, JSON.stringify(photosByDate))
  }, [photosByDate])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.calendarMetric, calendarMetric)
  }, [calendarMetric])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.calendarStyle, calendarStyle)
  }, [calendarStyle])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.selectedDate, selectedDate)
  }, [selectedDate])

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPromptEvent(event as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setInstallPromptEvent(null)
      setIsStandalone(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  useEffect(() => {
    if (!expandedDate) {
      return
    }

    const originalBodyOverflow = document.body.style.overflow
    const originalHtmlOverflow = document.documentElement.style.overflow

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalBodyOverflow
      document.documentElement.style.overflow = originalHtmlOverflow
    }
  }, [expandedDate])

  useEffect(() => setWeightDraft(String(weight)), [weight])
  useEffect(() => setRepsDraft(String(reps)), [reps])
  useEffect(() => setSetsDraft(String(sets)), [sets])
  useEffect(() => setDurationDraft(String(duration)), [duration])
  useEffect(() => setSpeedDraft(String(speed)), [speed])
  useEffect(() => setInclineDraft(String(incline)), [incline])

  useEffect(() => {
    if (!isSessionActive) {
      return
    }
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)

    return () => window.clearInterval(timer)
  }, [isSessionActive])

  const totalVolume = useMemo(
    () => logs.reduce((sum, log) => sum + log.weight * log.reps * log.sets, 0),
    [logs],
  )

  const loggedDuration = useMemo(
    () => logs.reduce((sum, log) => sum + log.duration, 0),
    [logs],
  )

  const sessionDuration = Math.max(loggedDuration, Math.floor(elapsedSeconds / 60))

  const currentBodyLoad = useMemo(() => {
    return logs.reduce<Record<BodyPart, number>>(
      (acc, log) => {
        const volume = log.weight * log.reps * log.sets
        acc[log.bodyPart] += volume > 0 ? volume : log.duration * 25
        return acc
      },
      {
        Chest: 0,
        Back: 0,
        Shoulders: 0,
        Arms: 0,
        Legs: 0,
        Core: 0,
        Cardio: 0,
      },
    )
  }, [logs])

  const addLog = () => {
    const cleanedExercise = exercise.trim()
    if (!cleanedExercise) {
      return
    }
    const isCardio = bodyPart === 'Cardio'
    const nextLog: ExerciseLog = {
      id: Date.now(),
      exercise: cleanedExercise,
      bodyPart,
      weight: isCardio ? 0 : clamp(weight, 0, 500),
      reps: isCardio ? 0 : clamp(reps, 1, 100),
      sets: isCardio ? 0 : clamp(sets, 1, 30),
      duration: clamp(duration, 1, 240),
      speed: isCardio ? clamp(speed, 1, 40) : undefined,
      incline: isCardio ? clamp(incline, 0, 30) : undefined,
    }
    setLogs((prev) => [nextLog, ...prev])
  }

  const startSession = () => setIsSessionActive(true)

  const endSession = () => {
    if (logs.length === 0 && elapsedSeconds < 120) {
      setIsSessionActive(false)
      return
    }

    const completedDate = dateKey(new Date())

    const newSummary: SessionSummary = {
      date: completedDate,
      duration: sessionDuration,
      volume: totalVolume,
      bodyLoad: currentBodyLoad,
    }

    if (logs.length > 0) {
      const completedEntries: WorkoutEntry[] = logs.map((log) => ({
        ...log,
        date: completedDate,
      }))
      setWorkoutEntries((prev) => [...prev, ...completedEntries])
    }

    setSessions((prev) => [...prev, newSummary])
    setLogs([])
    setElapsedSeconds(0)
    setIsSessionActive(false)
  }

  const weeklySessions = useMemo(() => {
    const liveSession: SessionSummary | null =
      logs.length > 0
        ? {
            date: dateKey(new Date()),
            duration: sessionDuration,
            volume: totalVolume,
            bodyLoad: currentBodyLoad,
          }
        : null

    const effectiveSessions = liveSession ? [...sessions, liveSession] : sessions

    const today = new Date()
    const weekAgo = new Date(today)
    weekAgo.setDate(today.getDate() - 6)
    return effectiveSessions.filter((session) => {
      const currentDate = new Date(session.date)
      return currentDate >= weekAgo && currentDate <= today
    }).length
  }, [sessions, logs.length, sessionDuration, totalVolume, currentBodyLoad])

  const weeklyProgress = clamp(Math.round((weeklySessions / weeklyGoal) * 100), 0, 100)
  const volumeProgress = clamp(
    Math.round((totalVolume / Math.max(volumeGoal, 1)) * 100),
    0,
    100,
  )

  const effectiveSessions = useMemo(() => {
    if (logs.length === 0) {
      return sessions
    }

    const liveSession: SessionSummary = {
      date: dateKey(new Date()),
      duration: sessionDuration,
      volume: totalVolume,
      bodyLoad: currentBodyLoad,
    }

    return [...sessions, liveSession]
  }, [sessions, logs.length, sessionDuration, totalVolume, currentBodyLoad])

  const recentSessions = effectiveSessions.slice(-7)
  const trendValues = recentSessions.map((item) => item.volume)
  const maxTrend = Math.max(...trendValues, 1)

  const trendPoints = trendValues
    .map((value, index) => {
      const x = (index / Math.max(trendValues.length - 1, 1)) * 100
      const y = 100 - (value / maxTrend) * 100
      return `${x},${y}`
    })
    .join(' ')

  const allBodyLoad = useMemo(() => {
    const monthSessions = effectiveSessions.filter((session) =>
      session.date.startsWith(currentMonthKey),
    )

    return monthSessions.reduce<Record<BodyPart, number>>(
      (acc, session) => {
        BODY_PARTS.forEach((part) => {
          acc[part] += session.bodyLoad[part] ?? 0
        })
        return acc
      },
      {
        Chest: 0,
        Back: 0,
        Shoulders: 0,
        Arms: 0,
        Legs: 0,
        Core: 0,
        Cardio: 0,
      },
    )
  }, [effectiveSessions, currentMonthKey])

  const maxBodyLoad = Math.max(...Object.values(allBodyLoad), 1)
  const topBodyPart = useMemo(() => {
    return BODY_PARTS.reduce(
      (best, part) =>
        allBodyLoad[part] > allBodyLoad[best] ? part : best,
      BODY_PARTS[0],
    )
  }, [allBodyLoad])

  const dailyStats = useMemo(() => {
    const map = new Map<string, { duration: number; volume: number }>()
    effectiveSessions.forEach((session) => {
      const prev = map.get(session.date) ?? { duration: 0, volume: 0 }
      map.set(session.date, {
        duration: prev.duration + session.duration,
        volume: prev.volume + session.volume,
      })
    })
    return map
  }, [effectiveSessions])

  const calendarData = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const firstDay = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const startWeekday = firstDay.getDay()

    const values = Array.from({ length: daysInMonth }, (_, index) => {
      const current = new Date(year, month, index + 1)
      const key = dateKey(current)
      const entry = dailyStats.get(key) ?? { duration: 0, volume: 0 }
      return calendarMetric === 'duration' ? entry.duration : entry.volume
    })

    const maxValue = Math.max(...values, 1)

    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const current = new Date(year, month, index + 1)
      const key = dateKey(current)
      const entry = dailyStats.get(key) ?? { duration: 0, volume: 0 }
      const value = calendarMetric === 'duration' ? entry.duration : entry.volume
      const ratio = value / maxValue

      let level = 0
      if (value > 0 && ratio <= 0.25) level = 1
      else if (ratio <= 0.5) level = 2
      else if (ratio <= 0.75) level = 3
      else level = 4

      return {
        day: index + 1,
        key,
        duration: entry.duration,
        volume: entry.volume,
        value,
        level,
      }
    })

    return {
      title: firstDay.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
      }),
      startWeekday,
      days,
    }
  }, [dailyStats, calendarMetric])

  const selectedPhoto = photosByDate[selectedDate]
  const expandedCell = useMemo(() => {
    if (!expandedDate) {
      return null
    }
    return calendarData.days.find((cell) => cell.key === expandedDate) ?? null
  }, [expandedDate, calendarData.days])

  const expandedPhoto = expandedDate ? photosByDate[expandedDate] : null

  const expandedEntries = useMemo(() => {
    if (!expandedDate) {
      return [] as WorkoutEntry[]
    }

    const saved = workoutEntries.filter((entry) => entry.date === expandedDate)
    const liveToday = expandedDate === dateKey(new Date())
      ? logs.map((log) => ({ ...log, date: expandedDate }))
      : []

    return [...saved, ...liveToday]
  }, [expandedDate, workoutEntries, logs])

  const expandedBodyLoad = useMemo(() => {
    return expandedEntries.reduce<Record<BodyPart, number>>(
      (acc, entry) => {
        const volume = entry.weight * entry.reps * entry.sets
        acc[entry.bodyPart] += volume > 0 ? volume : entry.duration * 25
        return acc
      },
      {
        Chest: 0,
        Back: 0,
        Shoulders: 0,
        Arms: 0,
        Legs: 0,
        Core: 0,
        Cardio: 0,
      },
    )
  }, [expandedEntries])

  const expandedBodyParts = useMemo(() => {
    const ranked = BODY_PARTS
      .map((part) => ({ part, value: expandedBodyLoad[part] }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)

    if (ranked.length > 0) {
      return ranked
    }

    return BODY_PARTS.map((part) => ({ part, value: expandedBodyLoad[part] }))
  }, [expandedBodyLoad])

  const expandedMaxBodyLoad = Math.max(...Object.values(expandedBodyLoad), 1)

  const attendanceDays = useMemo(() => {
    const activeDates = new Set(sessions.map((session) => session.date))
    if (logs.length > 0) {
      activeDates.add(dateKey(new Date()))
    }
    return activeDates.size
  }, [sessions, logs.length])

  const onSelectImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const imageData = typeof reader.result === 'string' ? reader.result : ''
      if (!imageData) {
        return
      }
      setPhotosByDate((prev) => ({ ...prev, [selectedDate]: imageData }))
      setCalendarStyle('photo')
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const removeSelectedPhoto = () => {
    setPhotosByDate((prev) => {
      const next = { ...prev }
      delete next[selectedDate]
      return next
    })
  }

  const triggerInstallPrompt = async () => {
    if (!installPromptEvent) {
      return
    }
    await installPromptEvent.prompt()
    await installPromptEvent.userChoice
    setInstallPromptEvent(null)
  }

  const commitWeight = () =>
    setWeight(parseIntegerInput(weightDraft, weight, 0, 500))
  const commitReps = () =>
    setReps(parseIntegerInput(repsDraft, reps, 1, 100))
  const commitSets = () =>
    setSets(parseIntegerInput(setsDraft, sets, 1, 30))
  const commitDuration = () =>
    setDuration(parseIntegerInput(durationDraft, duration, 1, 240))
  const commitSpeed = () =>
    setSpeed(parseDecimalInput(speedDraft, speed, 1, 40))
  const commitIncline = () =>
    setIncline(parseIntegerInput(inclineDraft, incline, 0, 30))

  const commitWeeklyGoal = () => {
    const next = parseGoalInput(weeklyGoalDraft, weeklyGoal, 1, 14)
    setWeeklyGoal(next)
  }

  const commitVolumeGoal = () => {
    const next = parseGoalInput(volumeGoalDraft, volumeGoal, 1000, 50000)
    setVolumeGoal(next)
  }

  return (
    <div className="app-shell">
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />
      <header className="mobile-topbar">
        <div className="mobile-topbar-main">
          <span className="mobile-topbar-pill">GYMUP</span>
          <strong>{mobileScreen === 'home' ? 'ホーム' : mobileScreen === 'recorder' ? '記録' : mobileScreen === 'visuals' ? '可視化' : 'カレンダー'}</strong>
        </div>
      </header>
      <header className="hero">
        <div>
          <p className="eyebrow">GYMUP / LOCAL MVP</p>
          <h1>Gym Pulse Dashboard</h1>
          <p className="hero-subtitle">
            トレーニングの内容、時間、重量を記録して、モチベーションが上がる可視化に変える。
          </p>
        </div>
        <div className="hero-chips">
          <div className="chip">
            <span>Today</span>
            <strong>{sessionDuration} min</strong>
          </div>
          <div className="chip">
            <span>Volume</span>
            <strong>{totalVolume.toLocaleString()} kg</strong>
          </div>
          <div className="chip">
            <span>Status</span>
            <strong>{isSessionActive ? 'IN SESSION' : 'READY'}</strong>
          </div>
        </div>
      </header>

      {!isStandalone ? (
        <section className="install-banner">
          <div>
            <strong>モバイルで単体起動する</strong>
            <p>ホーム画面に追加すると、アプリとして起動しオフラインでも利用しやすくなります。</p>
          </div>
          {installPromptEvent ? (
            <button className="primary install-btn" onClick={triggerInstallPrompt}>
              ホーム画面に追加
            </button>
          ) : (
            <p className="install-hint">iPhoneは共有メニュー → ホーム画面に追加</p>
          )}
        </section>
      ) : null}

      <section className={`home-engagement ${mobileScreen === 'home' ? 'is-active' : ''}`}>
        <MiniGoalRing
          value={weeklyProgress}
          label="Weekly Goal"
          sub={`${weeklySessions}/${weeklyGoal}`}
        />
        <MiniGoalRing
          value={volumeProgress}
          label="Volume Goal"
          sub={`${totalVolume.toLocaleString()}kg`}
        />
      </section>

      <main className="dashboard-grid">
        <section className={`mobile-home ${mobileScreen === 'home' ? 'is-active' : ''}`}>
          <button className="home-card tall card-main card-recorder" onClick={() => setMobileScreen('recorder')}>
            <span className="home-card-icon" aria-hidden="true">✎</span>
            <span className="home-card-title">Session Recorder</span>
            <strong>{isSessionActive ? 'LIVE SESSION' : '記録を追加'}</strong>
            <p>{logs.length} 件のログ / {sessionDuration} min</p>
            <div className="home-card-metrics">
              <span>{totalVolume.toLocaleString()} kg</span>
              <span>{bodyPart === 'Cardio' ? 'Cardio' : 'Strength'}</span>
            </div>
          </button>

          <button className="home-card card-side-top card-goal" onClick={() => setMobileScreen('visuals')}>
            <span className="home-card-icon" aria-hidden="true">◎</span>
            <span className="home-card-title">Goals & Rings</span>
            <strong>{weeklyProgress}% / {volumeProgress}%</strong>
            <p>週間目標とボリューム目標</p>
            <div className="home-card-metrics">
              <span>{weeklySessions}/{weeklyGoal} 回</span>
              <span>{volumeGoal.toLocaleString()} kg 目標</span>
            </div>
          </button>

          <button className="home-card card-side-bottom card-muscle" onClick={() => setMobileScreen('visuals')}>
            <span className="home-card-icon" aria-hidden="true">◉</span>
            <span className="home-card-title">Muscle Load Map</span>
            <strong>{BODY_PARTS.length} 部位トラッキング</strong>
            <p>部位別の負荷バランスを確認</p>
            <div className="home-card-metrics">
              <span>Top: {topBodyPart}</span>
              <span>{Math.round(allBodyLoad[topBodyPart]).toLocaleString()}</span>
            </div>
          </button>

          <button className="home-card wide card-wide card-trend" onClick={() => setMobileScreen('visuals')}>
            <span className="home-card-icon" aria-hidden="true">↗</span>
            <span className="home-card-title">Volume Trend</span>
            <strong>{recentSessions.length} セッション推移</strong>
            <p>最近のボリューム変化を可視化</p>
            <div className="home-card-metrics">
              <span>直近 {recentSessions.length} 回</span>
              <span>最大 {Math.round(maxTrend).toLocaleString()} kg</span>
            </div>
          </button>

          <button className="home-card wide card-wide card-calendar" onClick={() => setMobileScreen('calendar')}>
            <span className="home-card-icon" aria-hidden="true">▦</span>
            <span className="home-card-title">Attendance Calendar</span>
            <strong>{calendarData.title}</strong>
            <p>時間 / ボリューム / 写真を大きく表示</p>
            <div className="home-card-metrics">
              <span>{attendanceDays} 日記録</span>
              <span>{Object.keys(photosByDate).length} 枚の写真</span>
            </div>
          </button>
        </section>

        <section
          className={`panel recorder-panel ${mobileScreen === 'recorder' ? 'is-active' : ''}`}
        >
          <div className="panel-header">
            <h2>Session Recorder</h2>
            <span className={`status-dot ${isSessionActive ? 'active' : ''}`}>
              {isSessionActive ? 'LIVE' : 'IDLE'}
            </span>
          </div>

          <div className="timer">{formatSeconds(elapsedSeconds)}</div>

          <div className="session-actions">
            {!isSessionActive ? (
              <button className="primary" onClick={startSession}>
                セッション開始
              </button>
            ) : (
              <button className="danger" onClick={endSession}>
                セッション終了
              </button>
            )}
          </div>

          <div className="log-form">
            <label>
              種目
              <input
                value={exercise}
                onChange={(event) => setExercise(event.target.value)}
                placeholder="例: Bench Press"
              />
            </label>
            <label>
              部位
              <select
                value={bodyPart}
                onChange={(event) => setBodyPart(event.target.value as BodyPart)}
              >
                {BODY_PARTS.map((part) => (
                  <option key={part} value={part}>
                    {part}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              {bodyPart !== 'Cardio' ? (
                <>
                  <label>
                    重量(kg)
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={weightDraft}
                      onChange={(event) => setWeightDraft(event.target.value)}
                      onBlur={commitWeight}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          commitWeight()
                          event.currentTarget.blur()
                        }
                      }}
                    />
                  </label>
                  <label>
                    回数
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={repsDraft}
                      onChange={(event) => setRepsDraft(event.target.value)}
                      onBlur={commitReps}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          commitReps()
                          event.currentTarget.blur()
                        }
                      }}
                    />
                  </label>
                  <label>
                    セット
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={setsDraft}
                      onChange={(event) => setSetsDraft(event.target.value)}
                      onBlur={commitSets}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          commitSets()
                          event.currentTarget.blur()
                        }
                      }}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    スピード(km/h)
                    <input
                      type="text"
                      inputMode="decimal"
                      value={speedDraft}
                      onChange={(event) => setSpeedDraft(event.target.value)}
                      onBlur={commitSpeed}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          commitSpeed()
                          event.currentTarget.blur()
                        }
                      }}
                    />
                  </label>
                  <label>
                    傾斜(%)
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={inclineDraft}
                      onChange={(event) => setInclineDraft(event.target.value)}
                      onBlur={commitIncline}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          commitIncline()
                          event.currentTarget.blur()
                        }
                      }}
                    />
                  </label>
                </>
              )}
              <label>
                時間(min)
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={durationDraft}
                  onChange={(event) => setDurationDraft(event.target.value)}
                  onBlur={commitDuration}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      commitDuration()
                      event.currentTarget.blur()
                    }
                  }}
                />
              </label>
            </div>
            <button className="secondary" onClick={addLog}>
              記録を追加
            </button>
          </div>

          <div className="log-list">
            {logs.length === 0 ? (
              <p className="empty">まだ記録はありません。1セット追加してみましょう。</p>
            ) : (
              logs.map((log) => (
                <article key={log.id} className="log-item">
                  <div>
                    <strong>{log.exercise}</strong>
                    <p>{log.bodyPart}</p>
                  </div>
                  <div className="log-metrics">
                    {log.bodyPart !== 'Cardio' ? (
                      <>
                        <span>{log.weight}kg</span>
                        <span>{log.reps}reps</span>
                        <span>{log.sets}sets</span>
                      </>
                    ) : (
                      <>
                        <span>{log.speed ?? 0}km/h</span>
                        <span>{log.incline ?? 0}%</span>
                      </>
                    )}
                    <span>{log.duration}min</span>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section
          className={`panel visual-panel ${mobileScreen === 'visuals' ? 'is-active' : ''}`}
        >
          <h2>Motivation Visuals</h2>

          <div className="goal-card">
            <h3>Goal Settings</h3>
            <div className="goal-grid">
              <label>
                Weekly Goal (sessions)
                <input
                  className="goal-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={weeklyGoalDraft}
                  onChange={(event) => setWeeklyGoalDraft(event.target.value)}
                  onBlur={commitWeeklyGoal}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      commitWeeklyGoal()
                      event.currentTarget.blur()
                    }
                  }}
                />
              </label>
              <label>
                Volume Goal (kg)
                <input
                  className="goal-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={volumeGoalDraft}
                  onChange={(event) => setVolumeGoalDraft(event.target.value)}
                  onBlur={commitVolumeGoal}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      commitVolumeGoal()
                      event.currentTarget.blur()
                    }
                  }}
                />
              </label>
            </div>
          </div>

          <div className="ring-grid">
            <div className="ring-card">
              <ProgressRing value={weeklyProgress} label="Weekly Goal" sub={`${weeklySessions}/${weeklyGoal} sessions`} />
            </div>
            <div className="ring-card">
              <ProgressRing value={volumeProgress} label="Volume Goal" sub={`${totalVolume.toLocaleString()} / ${volumeGoal.toLocaleString()} kg`} />
            </div>
          </div>

          <div className="trend-card">
            <h3>Volume Trend</h3>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="trend-svg">
              <polyline points={trendPoints} />
            </svg>
            <div className="trend-labels">
              {recentSessions.map((session) => (
                <span key={`${session.date}-${session.volume}`}>{session.date.slice(5)}</span>
              ))}
            </div>
          </div>

          <div className="muscle-card">
            <h3>Muscle Load Map</h3>
            <div className="bars">
              {BODY_PARTS.map((part) => {
                const value = allBodyLoad[part]
                const width = (value / maxBodyLoad) * 100
                return (
                  <div key={part} className="bar-row">
                    <span>{part}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${width}%` }} />
                    </div>
                    <strong>{Math.round(value).toLocaleString()}</strong>
                  </div>
                )
              })}
            </div>
          </div>

        </section>

        <section
          className={`panel calendar-panel ${mobileScreen === 'calendar' ? 'is-active' : ''}`}
        >
          <div className="heatmap-card large">
            <div className="calendar-header">
              <h3>Attendance Calendar</h3>
              <div className="calendar-controls">
                <div className="metric-toggle" role="group" aria-label="calendar metric switch">
                  <button
                    className={`metric-btn ${calendarMetric === 'duration' ? 'active' : ''}`}
                    onClick={() => setCalendarMetric('duration')}
                  >
                    時間
                  </button>
                  <button
                    className={`metric-btn ${calendarMetric === 'volume' ? 'active' : ''}`}
                    onClick={() => setCalendarMetric('volume')}
                  >
                    ボリューム
                  </button>
                </div>
                <div className="metric-toggle" role="group" aria-label="calendar style switch">
                  <button
                    className={`metric-btn ${calendarStyle === 'heat' ? 'active' : ''}`}
                    onClick={() => setCalendarStyle('heat')}
                  >
                    ヒート
                  </button>
                  <button
                    className={`metric-btn ${calendarStyle === 'photo' ? 'active' : ''}`}
                    onClick={() => setCalendarStyle('photo')}
                  >
                    スタイル
                  </button>
                </div>
              </div>
            </div>

            <p className="calendar-month">{calendarData.title}</p>

            <div className="weekday-row">
              {WEEKDAYS.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className={`calendar-grid ${calendarStyle === 'photo' ? 'photo-grid' : ''}`}>
              {Array.from({ length: calendarData.startWeekday }, (_, index) => (
                <div key={`blank-${index}`} className="calendar-cell blank" />
              ))}
              {calendarData.days.map((cell) => (
                <div
                  key={cell.key}
                  className={`calendar-cell level-${cell.level} ${selectedDate === cell.key ? 'selected' : ''} ${calendarStyle === 'photo' ? 'photo-mode' : ''}`}
                  title={`${cell.key} / ${cell.duration} min / ${cell.volume.toLocaleString()} kg`}
                  onClick={() => {
                    setSelectedDate(cell.key)
                    if (calendarStyle === 'photo' && photosByDate[cell.key]) {
                      setExpandedDate(cell.key)
                    }
                  }}
                >
                  {calendarStyle === 'photo' && photosByDate[cell.key] ? (
                    <img src={photosByDate[cell.key]} alt="Workout" className="calendar-photo" />
                  ) : null}
                  <span className="date-number">{cell.day}</span>
                  <span className="date-metric">
                    {calendarMetric === 'duration'
                      ? `${cell.duration}m`
                      : `${Math.round(cell.volume / 1000)}k`}
                  </span>
                </div>
              ))}
            </div>

            <div className="photo-uploader">
              <div>
                <p className="upload-date">選択日: {selectedDate}</p>
                <p className="upload-help">ジムに行った日に撮った写真を追加できます。</p>
              </div>
              <div className="upload-actions">
                <button className="secondary" onClick={() => uploadInputRef.current?.click()}>
                  画像をアップロード
                </button>
                <button className="secondary" onClick={() => cameraInputRef.current?.click()}>
                  カメラで撮る
                </button>
                <button
                  className="secondary"
                  onClick={removeSelectedPhoto}
                  disabled={!selectedPhoto}
                >
                  写真を削除
                </button>
              </div>

              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*"
                onChange={onSelectImage}
                className="hidden-input"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="user"
                onChange={onSelectImage}
                className="hidden-input"
              />

              {selectedPhoto ? (
                <img src={selectedPhoto} alt="Selected workout" className="selected-preview" />
              ) : (
                <p className="upload-empty">この日付の写真はまだありません。</p>
              )}
            </div>
          </div>
        </section>
      </main>

      {expandedCell && expandedPhoto ? (
        <div className="calendar-preview-backdrop" onClick={() => setExpandedDate(null)}>
          <div className="calendar-preview-card" onClick={(event) => event.stopPropagation()}>
            <button
              className="calendar-preview-close"
              onClick={() => setExpandedDate(null)}
              aria-label="プレビューを閉じる"
            >
              ×
            </button>
            <img src={expandedPhoto} alt="Workout preview" className="calendar-preview-image" />
            <div className="calendar-preview-meta">
              <strong>{expandedCell.key}</strong>
              <p>{expandedCell.duration} min</p>
              <p>{expandedCell.volume.toLocaleString()} kg</p>
            </div>

            <div className="calendar-preview-content">
              <section className="preview-section">
                <h4>その日にやったこと</h4>
                {expandedEntries.length === 0 ? (
                  <p className="preview-empty">種目詳細の履歴はまだありません。</p>
                ) : (
                  <div className="preview-entry-list">
                    {expandedEntries.map((entry) => (
                      <article key={`${entry.id}-${entry.date}`} className="preview-entry-item">
                        <div>
                          <strong>{entry.exercise}</strong>
                          <span>{entry.bodyPart}</span>
                        </div>
                        <div className="preview-entry-metrics">
                          {entry.bodyPart !== 'Cardio' ? (
                            <>
                              <span>{entry.weight}kg</span>
                              <span>{entry.reps}reps</span>
                              <span>{entry.sets}sets</span>
                            </>
                          ) : (
                            <>
                              <span>{entry.speed ?? 0}km/h</span>
                              <span>{entry.incline ?? 0}%</span>
                            </>
                          )}
                          <span>{entry.duration}min</span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="preview-section">
                <h4>部位別エンゲージメント（記録あり）</h4>
                <div className="preview-body-bars">
                  {expandedBodyParts.map(({ part, value }) => {
                    const width = (value / expandedMaxBodyLoad) * 100

                    return (
                      <div key={`preview-${part}`} className="preview-body-row">
                        <span>{part}</span>
                        <div className="preview-body-track">
                          <div className="preview-body-fill" style={{ width: `${width}%` }} />
                        </div>
                        <strong>{Math.round(value).toLocaleString()}</strong>
                      </div>
                    )
                  })}
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      <nav className="mobile-bottom-nav" aria-label="app bottom navigation">
        <button
          className={`mobile-bottom-btn ${mobileScreen === 'home' ? 'active' : ''}`}
          onClick={() => setMobileScreen('home')}
        >
          <svg viewBox="0 0 24 24" className="nav-icon icon-stroke" aria-hidden="true">
            <path d="M3 11.5L12 4l9 7.5" />
            <path d="M7.5 10.5V20h9v-9.5" />
          </svg>
          <span className="nav-label">ホーム</span>
        </button>
        <button
          className={`mobile-bottom-btn ${mobileScreen === 'recorder' ? 'active' : ''}`}
          onClick={() => setMobileScreen('recorder')}
        >
          <svg viewBox="0 0 24 24" className="nav-icon icon-stroke" aria-hidden="true">
            <path d="M4 20h4l10.4-10.4a1.8 1.8 0 0 0 0-2.5l-1.5-1.5a1.8 1.8 0 0 0-2.5 0L4 16v4z" />
            <path d="M13.2 6.8l4 4" />
          </svg>
          <span className="nav-label">記録</span>
        </button>
        <button
          className={`mobile-bottom-btn ${mobileScreen === 'visuals' ? 'active' : ''}`}
          onClick={() => setMobileScreen('visuals')}
        >
          <svg viewBox="0 0 24 24" className="nav-icon icon-stroke" aria-hidden="true">
            <path d="M12 3a9 9 0 1 0 9 9" />
            <path d="M12 3v9l6.5 3.5" />
          </svg>
          <span className="nav-label">可視化</span>
        </button>
        <button
          className={`mobile-bottom-btn ${mobileScreen === 'calendar' ? 'active' : ''}`}
          onClick={() => setMobileScreen('calendar')}
        >
          <svg viewBox="0 0 24 24" className="nav-icon icon-stroke" aria-hidden="true">
            <rect x="4" y="5" width="16" height="15" rx="2" />
            <path d="M8 3.5v3M16 3.5v3M4 10h16M8 14h3M13 14h3M8 17h3" />
          </svg>
          <span className="nav-label">カレンダー</span>
        </button>
      </nav>
    </div>
  )
}

type ProgressRingProps = {
  value: number
  label: string
  sub: string
}

type MiniGoalRingProps = {
  value: number
  label: string
  sub: string
}

function MiniGoalRing({ value, label, sub }: MiniGoalRingProps) {
  const radius = 24
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="mini-goal-card">
      <svg viewBox="0 0 64 64" className="mini-goal-ring" aria-hidden="true">
        <circle cx="32" cy="32" r={radius} className="mini-ring-bg" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          className="mini-ring-fg"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="mini-goal-meta">
        <strong>{value}%</strong>
        <span>{label}</span>
        <p>{sub}</p>
      </div>
    </div>
  )
}

function ProgressRing({ value, label, sub }: ProgressRingProps) {
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="progress-ring-wrap">
      <svg viewBox="0 0 120 120" className="progress-ring">
        <circle cx="60" cy="60" r={radius} className="ring-bg" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          className="ring-fg"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ring-center">
        <strong>{value}%</strong>
        <span>{label}</span>
      </div>
      <p>{sub}</p>
    </div>
  )
}

export default App
