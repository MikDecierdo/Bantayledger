import LocalEventsSettings from '../components/settings/LocalEventsSettings';
import PageHeader from '../components/layout/PageHeader';
import { Bento, Workspace } from '../components/layout/Workspace';
import { t } from '../i18n';
import './Settings.css';

/** Opened from the shortcut beside Profile in the menu. */
export function LocalEvents() {
  return (
    <Workspace>
      <PageHeader title={t('Local events')} />
      <Bento className="bl-set__bento">
        <div className="bl-set__layout bl-set__layout--single bl-span-12 bl-scroll">
          <LocalEventsSettings />
        </div>
      </Bento>
    </Workspace>
  );
}

export default LocalEvents;
