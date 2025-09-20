"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function PlayerPortalLogin() {
  const [lastName, setLastName] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const months = [
    { label: 'January', value: '01' },
    { label: 'February', value: '02' },
    { label: 'March', value: '03' },
    { label: 'April', value: '04' },
    { label: 'May', value: '05' },
    { label: 'June', value: '06' },
    { label: 'July', value: '07' },
    { label: 'August', value: '08' },
    { label: 'September', value: '09' },
    { label: 'October', value: '10' },
    { label: 'November', value: '11' },
    { label: 'December', value: '12' },
  ]

  const years = [
    { label: '2011', value: '11' },
    { label: '2012', value: '12' },
    { label: '2013', value: '13' },
    { label: '2014', value: '14' },
    { label: '2015', value: '15' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/player/lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lastName,
          birthMonth: birthMonth,
          birthYear: birthYear,
        }),
      })

      const data = await response.json()

      if (data.success) {
        router.push(`/player-portal/${data.playerPortalId}`)
      } else {
        setError(data.error || 'Login failed')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">
            Madison Ultimate
          </CardTitle>
          <CardDescription className="font-semibold text-gray-700">
            Player Portal Login
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lastName" className="font-semibold text-gray-800">Player Last Name</Label>
              <Input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter player last name"
                required
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="birthMonth" className="font-semibold text-gray-800">Player Birth Month</Label>
                <Select value={birthMonth} onValueChange={setBirthMonth} disabled={isLoading}>
                  <SelectTrigger className="data-[placeholder]:text-gray-600">
                    <SelectValue placeholder="Select month" className="text-gray-800" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value} className="text-gray-800 font-medium">
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthYear" className="font-semibold text-gray-800">Player Birth Year</Label>
                <Select value={birthYear} onValueChange={setBirthYear} disabled={isLoading}>
                  <SelectTrigger className="data-[placeholder]:text-gray-600">
                    <SelectValue placeholder="Select year" className="text-gray-800" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year.value} value={year.value} className="text-gray-800 font-medium">
                        {year.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded font-medium">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-700">
            <a
              href="mailto:madisonultimate@gmail.com"
              className="text-blue-600 hover:text-blue-800 underline font-semibold"
            >
              Need help?
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}