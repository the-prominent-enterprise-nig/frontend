'use server'

import { api } from '@/src/libs/api/client'
import type { TableStatus } from '@/src/libs/data/RestaurantData'

export async function updateTableStatus(tableId: string, status: TableStatus) {
  return api.patch(`/restaurant/tables/${tableId}/status`, { status })
}

export async function getKitchenTickets() {
  return api.get('/restaurant/kitchen/tickets')
}

export async function updateKitchenTicketStatus(id: string, status: string) {
  return api.patch(`/restaurant/kitchen/tickets/${id}/status`, { status })
}
