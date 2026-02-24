export type UserRole = 'teknisi' | 'supervisor' | 'admin';

export type DeviceStatus = 'active' | 'repair' | 'broken';

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    factory_access: string[];
    createdAt?: Date;
}

export interface Device {
    id: string;
    mcid: string;
    mac_address: string;
    factory: string;
    line: string;
    status: DeviceStatus;
    last_update: Date;
    created_at: Date;
}

export interface Repair {
    id: string;
    device_id: string;
    mcid: string;
    mac_address: string;
    factory: string;
    line: string;
    date: Date;
    problem: string;
    action: string;
    technician_name: string;
    /** @deprecated Gunakan media[]. Tetap didukung untuk data lama. */
    photo_url?: string;
    /** Daftar URL foto/media repair (Cloudinary). */
    media?: string[];
    status: 'pending' | 'completed' | 'approved';
    createdAt?: Date;
}

export interface Installation {
    id: string;
    mcid: string;
    mac_address: string;
    factory: string;
    line: string;
    date_install: Date;
    technician: string;
    createdAt?: Date;
}

/** Riwayat ganti IoT: device lama (mcid_old, mac_old opsional) diganti dengan data baru. */
export interface Replacement {
    id: string;
    mcid_old: string;
    mac_old?: string;
    mcid_new: string;
    mac_address_new: string;
    factory: string;
    line: string;
    date_replace: Date;
    technician: string;
    createdAt?: Date;
}

export interface FactoryStatDetail {
    factory: string;
    active: number;
    broken: number;
    repairsThisMonth: number;
    totalDevices: number;
}

export interface LineStatsByFactory {
    factory: string;
    lines: { line: string; count: number }[];
}

export interface DashboardStats {
    totalActive: number;
    totalBroken: number;
    totalRepairsThisMonth: number;
    factoryStats: { factory: string; count: number }[];
    lineStats: { line: string; count: number }[];
    lineStatsByFactory: LineStatsByFactory[];
    factoryDetail: FactoryStatDetail[];
}
