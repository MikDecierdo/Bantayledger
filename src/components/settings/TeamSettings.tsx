import { IonIcon } from '@ionic/react';
import { eyeOffOutline, eyeOutline, peopleOutline } from 'ionicons/icons';
import { useCallback, useEffect, useState } from 'react';
import { t } from '../../i18n';
import { toUserMessage } from '../../lib/errors';
import { businessService, type TeamMember } from '../../services/api/accountService';
import { evaluatePassword } from '../../utils/passwordStrength';
import { formatPhLocal, isValidPhMobile, normalizePhLocal, toPhE164 } from '../../utils/phone';
import PasswordStrength from '../auth/PasswordStrength';
import Button from '../common/Button';
import { TextField } from '../common/Field';
import Modal, { ConfirmDialog } from '../common/Modal';
import { Badge } from '../common/StatusBadge';
import { useToast } from '../common/ToastProvider';
import { Card } from '../layout/Section';
import { useAuth } from '../../context/AuthContext';

const NO_RULES = { length: '', upper: '', lower: '', number: '', symbol: '' };

/**
 * The owner's team: who can sign in to this business. The owner creates a
 * login for each helper (there is no email invitation yet) and can reset a
 * helper's password or remove them. Staff see the list only.
 */
export function TeamSettings() {
  const { activeBusiness, isManager, user } = useAuth();
  const { showToast } = useToast();
  const businessId = activeBusiness?.id;

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [resetFor, setResetFor] = useState<TeamMember | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [removeFor, setRemoveFor] = useState<TeamMember | null>(null);

  const load = useCallback(async () => {
    if (!businessId) return;
    try {
      setMembers(await businessService.members(businessId));
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetAddForm = () => {
    setFullName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setErrors({});
    setShowPassword(false);
  };

  const handleAdd = async () => {
    if (!businessId) return;
    const next: Record<string, string> = {};
    if (!fullName.trim()) next.fullName = t('Enter the full name.');
    if (!email.trim()) next.email = t('Enter your email address.');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = t('Enter a valid email address.');
    if (phone && !isValidPhMobile(phone)) next.phone = t('Enter a valid Philippine mobile number, e.g. 917 123 4567.');
    if (!password) next.password = t('Choose a password.');
    else if (!evaluatePassword(password, NO_RULES).ok) {
      next.password = t('Use a stronger password: add the items still unchecked below.');
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await businessService.addMember(businessId, {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: toPhE164(phone) || undefined,
        password,
      });
      showToast(t('Staff account created.'));
      setAddOpen(false);
      resetAddForm();
      await load();
    } catch (error) {
      setErrors({ form: toUserMessage(error, t('Could not add this person. Please try again.')) });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!businessId || !resetFor) return;
    if (!evaluatePassword(newPassword, NO_RULES).ok) {
      setErrors({ reset: t('Use a stronger password: add the items still unchecked below.') });
      return;
    }
    setSaving(true);
    try {
      await businessService.resetMemberPassword(businessId, resetFor.userId, newPassword);
      showToast(t('Password updated. Share it with {{name}}.', { name: resetFor.fullName }));
      setResetFor(null);
      setNewPassword('');
      setErrors({});
    } catch (error) {
      setErrors({ reset: toUserMessage(error, t('Could not update the password.')) });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!businessId || !removeFor) return;
    try {
      await businessService.removeMember(businessId, removeFor.userId);
      showToast(t('Staff removed.'));
      await load();
    } catch (error) {
      showToast(toUserMessage(error, t('Could not remove this person.')));
    } finally {
      setRemoveFor(null);
    }
  };

  const onlyOwner = members.filter((m) => m.role !== 'OWNER').length === 0;

  return (
    <>
      <Card className="bl-set__group" padding="none">
        <header className="bl-set__group-head">
          <span className="bl-set__group-icon" aria-hidden="true">
            <IonIcon icon={peopleOutline} />
          </span>
          <div>
            <h2 className="bl-card-title">{t('Team')}</h2>
            <p className="bl-caption">{t('The owner and the staff who can sign in to this business.')}</p>
          </div>
          {isManager && (
            <Button variant="primary" size="sm" onClick={() => setAddOpen(true)} style={{ marginLeft: 'auto' }}>
              {t('Add staff')}
            </Button>
          )}
        </header>
        <div className="bl-set__rows">
          {loading ? (
            <div className="bl-set__row">
              <span className="bl-caption">{t('Loading')}</span>
            </div>
          ) : (
            members.map((m) => (
              <div className="bl-set__row" key={m.userId}>
                <div className="bl-set__row-text">
                  <span className="bl-set__row-title">
                    {m.fullName}
                    {m.userId === user?.id ? ` (${t('You')})` : ''}
                  </span>
                  <span className="bl-caption">{m.email}</span>
                </div>
                <div className="bl-set__row-control" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Badge tone={m.role === 'OWNER' ? 'success' : 'neutral'}>
                    {m.role === 'OWNER' ? t('Owner') : t('Staff')}
                  </Badge>
                  {isManager && m.role === 'STAFF' && (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => setResetFor(m)}>
                        {t('Reset password')}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setRemoveFor(m)}>
                        {t('Remove')}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
          {!loading && onlyOwner && (
            <div className="bl-set__row">
              <span className="bl-caption">
                {isManager
                  ? t('You are the only member. Add staff so helpers can record sales.')
                  : t('No other members yet.')}
              </span>
            </div>
          )}
        </div>
      </Card>

      <Modal
        isOpen={addOpen}
        onClose={() => {
          setAddOpen(false);
          resetAddForm();
        }}
        title={t('Add staff')}
        icon="team"
        description={t('Staff can record sales, purchases, expenses and stock. They cannot change products or the team.')}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setAddOpen(false);
                resetAddForm();
              }}
              disabled={saving}
            >
              {t('Cancel')}
            </Button>
            <Button variant="primary" onClick={() => void handleAdd()} loading={saving}>
              {saving ? t('Saving') : t('Create staff account')}
            </Button>
          </>
        }
      >
        {errors.form && (
          <p className="bl-login__formerror" role="alert">
            {errors.form}
          </p>
        )}
        <div className="bl-form-grid">
          <TextField
            label={t('Full name')}
            value={fullName}
            error={errors.fullName}
            required
            autoComplete="off"
            onChange={(e) => setFullName(e.target.value)}
          />
          <TextField
            label={t('Email address')}
            type="email"
            value={email}
            error={errors.email}
            required
            autoComplete="off"
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label={t('Mobile number')}
            optional
            type="tel"
            inputMode="numeric"
            className="bl-field--phone"
            prefix="+63"
            placeholder="9XX XXX XXXX"
            value={formatPhLocal(phone)}
            error={errors.phone}
            onChange={(e) => setPhone(normalizePhLocal(e.target.value))}
          />
          <div className="bl-login__password">
            <TextField
              label={t('Password')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              error={errors.password}
              required
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="bl-login__reveal"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t('Hide password') : t('Show password')}
            >
              <IonIcon icon={showPassword ? eyeOffOutline : eyeOutline} aria-hidden="true" />
            </button>
          </div>
          <PasswordStrength password={password} />
          <p className="bl-caption">{t('Give this password to your staff. They can sign in with their email right away.')}</p>
        </div>
      </Modal>

      <Modal
        isOpen={resetFor !== null}
        onClose={() => {
          setResetFor(null);
          setNewPassword('');
          setErrors({});
        }}
        title={t('Reset password')}
        icon="password"
        description={resetFor ? t('Set a new password for {{name}}. They will be signed out everywhere.', { name: resetFor.fullName }) : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetFor(null)} disabled={saving}>
              {t('Cancel')}
            </Button>
            <Button variant="primary" onClick={() => void handleReset()} loading={saving}>
              {t('Save new password')}
            </Button>
          </>
        }
      >
        {errors.reset && (
          <p className="bl-login__formerror" role="alert">
            {errors.reset}
          </p>
        )}
        <TextField
          label={t('New password')}
          type="password"
          autoComplete="new-password"
          value={newPassword}
          required
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <PasswordStrength password={newPassword} />
      </Modal>

      <ConfirmDialog
        isOpen={removeFor !== null}
        title={t('Remove this staff member?')}
        message={t('They will no longer be able to sign in to this business. Their past records stay.')}
        confirmLabel={t('Remove')}
        tone="danger"
        onConfirm={() => void handleRemove()}
        onCancel={() => setRemoveFor(null)}
      />
    </>
  );
}

export default TeamSettings;
