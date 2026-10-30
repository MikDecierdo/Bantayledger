import { compassOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { EmptyState } from '../components/common/States';
import { t } from '../i18n';

export function NotFound() {
  const history = useHistory();

  return (
    <EmptyState
      icon={compassOutline}
      title={t('Page not found')}
      description={t('That page does not exist, or it may have moved. Let\'s get you back to your dashboard.')}
      actionLabel={t('Go to Dashboard')}
      onAction={() => history.push('/dashboard')}
    />
  );
}

export default NotFound;
