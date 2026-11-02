import SubscriptionSettings from '../components/settings/SubscriptionSettings';
import PageHeader from '../components/layout/PageHeader';
import { Bento, Workspace } from '../components/layout/Workspace';
import { t } from '../i18n';
import './Settings.css';

/** Opened from the shortcut beside Profile in the menu. */
export function Subscription() {
  return (
    <Workspace>
      <PageHeader title={t('Subscription')} />
      <Bento className="bl-set__bento">
        <div className="bl-set__layout bl-set__layout--single bl-span-12 bl-scroll">
          <SubscriptionSettings />
        </div>
      </Bento>
    </Workspace>
  );
}

export default Subscription;
