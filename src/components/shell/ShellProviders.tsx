'use client'

import dynamic from 'next/dynamic'

const Item360Drawer = dynamic(() => import('@/src/components/inventory/item-360/Item360Drawer'), {
  ssr: false,
})

export default function ShellProviders() {
  return (
    <>
      <Item360Drawer />
    </>
  )
}
