import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Monitor } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">Smart Queue Management System</h1>
          <p className="text-xl text-gray-600">
            Virtual queuing solution for small businesses
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <CardTitle>Customer Kiosk</CardTitle>
              <CardDescription>
                Join the queue by entering your details. Get a digital ticket and real-time updates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/kiosk">
                <Button className="w-full" size="lg">
                  Join Queue
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <Monitor className="w-6 h-6 text-indigo-600" />
              </div>
              <CardTitle>Staff Dashboard</CardTitle>
              <CardDescription>
                Manage the queue in real-time. Call next customer, complete tickets, and track analytics.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard">
                <Button className="w-full" size="lg" variant="outline">
                  Open Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-sm text-gray-500">
          <p>Select an option above to get started</p>
        </div>
      </div>
    </div>
  );
}
