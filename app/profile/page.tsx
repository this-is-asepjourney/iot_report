'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { User } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8 pb-24 md:pb-8">
          <h1 className="text-3xl font-bold mb-8">Profile</h1>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informasi User
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Nama</p>
                <p className="text-lg font-semibold">{user?.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="text-lg font-semibold">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <p className="text-lg font-semibold capitalize">{user?.role}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Factory Access</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {user?.factory_access?.map((factory) => (
                    <span
                      key={factory}
                      className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm"
                    >
                      {factory}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </ProtectedRoute>
  );
}
