import { PublicEventsDiscovery } from '@/components/public/PublicEventsDiscovery';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NST Events — Discover Campus Events, Hackathons & Workshops',
  description: 'Explore upcoming and past hackathons, workshops, competitions, and student club events at Newton School of Technology.',
  openGraph: {
    title: 'NST Events — Discover Campus Events',
    description: 'Explore upcoming hackathons, workshops, competitions, and club events.',
    type: 'website',
  },
};

export default function HomePage() {
  return <PublicEventsDiscovery initialScope="upcoming" />;
}
