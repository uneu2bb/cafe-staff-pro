import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
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
          border: '12px solid #D6A84F',
          borderRadius: 36,
        }}
      >
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 999,
            background: '#D6A84F',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#080b0e',
            fontSize: 48,
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
