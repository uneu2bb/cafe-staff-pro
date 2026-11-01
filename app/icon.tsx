import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#080b0e',
          border: '28px solid #D6A84F',
          borderRadius: 96,
        }}
      >
        <div
          style={{
            width: 220,
            height: 220,
            borderRadius: 999,
            background: '#D6A84F',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#080b0e',
            fontSize: 120,
            fontWeight: 900,
          }}
        >
          L
        </div>
      </div>
    ),
    size
  )
}
