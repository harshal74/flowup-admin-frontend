import { User, Mail, Shield, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRestaurant } from '../context/RestaurantContext';

export default function ProfilePage() {
  const { user } = useAuth();
  const { restaurant } = useRestaurant();

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Admin Profile</h1>
        <p className="text-secondary-500 dark:text-secondary-400 text-sm mt-0.5">
          Your account information
        </p>
      </div>

      <div className="card p-6 space-y-5">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary-500/20 flex items-center justify-center">
            <User className="w-8 h-8 text-primary-500" />
          </div>
          <div>
            <p className="text-lg font-bold text-secondary-900 dark:text-white">{user.name}</p>
            <p className="text-sm text-secondary-500 dark:text-secondary-400">{user.role || 'ADMIN'}</p>
          </div>
        </div>

        <div className="border-t border-secondary-200 dark:border-secondary-700" />

        {/* Info Grid */}
        <div className="space-y-4">
          <InfoRow icon={Mail} label="Email" value={user.email} />
          <InfoRow icon={Shield} label="Role" value={user.role || 'ADMIN'} />
          <InfoRow icon={Building2} label="Restaurant" value={restaurant?.restaurantName || '—'} />
          <InfoRow icon={Building2} label="Restaurant ID" value={user.restaurantId} mono />
          {restaurant?.restaurantSlug && (
            <InfoRow icon={Building2} label="Public Slug" value={restaurant.restaurantSlug} mono />
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-secondary-100 dark:bg-secondary-700 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-secondary-500 dark:text-secondary-400" />
      </div>
      <div>
        <p className="text-xs text-secondary-500 dark:text-secondary-400">{label}</p>
        <p className={`text-sm font-medium text-secondary-900 dark:text-white ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  );
}
