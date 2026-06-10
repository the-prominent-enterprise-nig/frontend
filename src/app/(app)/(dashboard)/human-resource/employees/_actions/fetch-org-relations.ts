'use server'

import { api } from '@/src/libs/api/client'

export interface Department {
  id: string
  name: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Position {
  id: string
  title: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Branch {
  id: string
  name: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface OrgRelations {
  departments: Department[]
  positions: Position[]
  branches: Branch[]
}

export async function fetchOrgRelations(): Promise<OrgRelations> {
  const response = await api.get<OrgRelations>(
    '/employees/org-relations',
    {},
    {
      tags: ['org-relations'],
    }
  )
  return response.data || { departments: [], positions: [], branches: [] }
}
