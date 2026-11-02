import { redirect } from 'next/navigation';

export default function OwnerDirectListingRedirectPage() {
  redirect('/app/owner/listings/new');
}

