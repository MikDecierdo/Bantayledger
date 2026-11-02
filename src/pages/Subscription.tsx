import SubscriptionSettings from '../components/settings/SubscriptionSettings';
import { Workspace } from '../components/layout/Workspace';

/** Opened from Upgrade beside the store name, or the shortcut beside Profile. */
export function Subscription() {
  return (
    <Workspace>
      <SubscriptionSettings />
    </Workspace>
  );
}

export default Subscription;
