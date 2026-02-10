type Event = {
  id: string
  type: string
  payload: any
  createdAt: number
}

const events: Event[] = []

export function appendEvent(type: string, payload: any) {
  events.push({
    id: crypto.randomUUID(),
    type,
    payload,
    createdAt: Date.now()
  })
}

export function getEvents() {
  return events
}
