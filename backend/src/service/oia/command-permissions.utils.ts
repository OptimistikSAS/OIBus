import { COMMAND_PERMISSIONS, CommandPermission, RegistrationCommandPermissions } from '../../../shared/model/domain/engine.model';
import { COMMAND_REQUIRED_PERMISSIONS, OIBUS_COMMAND_TYPES, OIBusCommandType } from '../../../shared/model/oia/command.model';

/**
 * Whether the permissions allow the command: it must be granted every permission the command requires.
 */
export const isCommandAllowed = (type: OIBusCommandType, permissions: RegistrationCommandPermissions): boolean =>
  COMMAND_REQUIRED_PERMISSIONS[type].every(permission => permissions[permission]);

/**
 * The commands the permissions allow, sent to OIAnalytics so that it only offers those.
 */
export const getAllowedCommands = (permissions: RegistrationCommandPermissions): Array<OIBusCommandType> =>
  OIBUS_COMMAND_TYPES.filter(type => isCommandAllowed(type, permissions));

/**
 * Applies the permissions sent by OIAnalytics to the local ones. OIAnalytics can only revoke a permission, never grant it:
 * a permission revoked locally can only be granted again from OIBus.
 */
export const applyRemoteCommandPermissions = (
  local: RegistrationCommandPermissions,
  sent: RegistrationCommandPermissions
): RegistrationCommandPermissions =>
  Object.fromEntries(COMMAND_PERMISSIONS.map(permission => [permission, local[permission] && sent[permission]])) as Record<
    CommandPermission,
    boolean
  >;
