'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Settings } from 'lucide-react';

export default function AdminPage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8 pb-24 md:pb-8">
          <h1 className="text-3xl font-bold mb-8">Admin Panel</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Manage Users
                </CardTitle>
                <CardDescription>
                  Kelola user, role, dan factory access
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Fitur ini akan dikembangkan lebih lanjut
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Manage Factory & Line</CardTitle>
                <CardDescription>
                  Kelola data factory dan line
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Fitur ini akan dikembangkan lebih lanjut
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Backup Data</CardTitle>
                <CardDescription>
                  Backup dan restore data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Fitur ini akan dikembangkan lebih lanjut
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
