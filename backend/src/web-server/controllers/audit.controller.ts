import { Controller, Get, Path, Query, Request, Route, Tags } from 'tsoa';
import { Page } from '../../../shared/model/types';
import { AuditLogDTO } from '../../../shared/model/audit.model';
import { AuditAction, AuditEntityType, AuditLog, AuditSearchParam } from '../../model/audit.model';
import { CustomExpressRequest } from '../express';

/**
 * Maps an internal AuditLog to its DTO representation.
 */
export function toAuditLogDTO(auditLog: AuditLog): AuditLogDTO {
  return {
    id: auditLog.id,
    entityType: auditLog.entityType,
    entityId: auditLog.entityId,
    action: auditLog.action,
    previousState: auditLog.previousState,
    newState: auditLog.newState,
    userId: auditLog.userId,
    createdAt: auditLog.createdAt
  };
}

@Route('/api/audit')
@Tags('Audit')
/**
 * Audit Trail API
 * @description Endpoints for searching and consulting the audit trail recorded against configuration changes
 */
export class AuditController extends Controller {
  /**
   * Searches audit log entries with optional filtering by entity type, entity id, action, and time range.
   * @summary Search audit log entries
   * @param entityType Filter by entity type (e.g. `south_connector`).
   * @param entityId Filter by the identifier of the audited entity.
   * @param action Filter by the kind of change performed. Valid values: `CREATE`, `UPDATE`, `DELETE`.
   * @param start ISO 8601 start of the time range.
   * @param end ISO 8601 end of the time range.
   * @returns {Page<AuditLogDTO>} Paginated list of audit log entries
   */
  @Get('/')
  search(
    @Request() request: CustomExpressRequest,
    @Query() entityType?: string,
    @Query() entityId?: string,
    @Query() action?: string,
    @Query() start?: string,
    @Query() end?: string,
    @Query() page = 0
  ): Page<AuditLogDTO> {
    const searchParams: AuditSearchParam = {
      entityType: entityType as AuditEntityType | undefined,
      entityId,
      action: action as AuditAction | undefined,
      start,
      end,
      page: page ? parseInt(page.toString(), 10) : 0
    };

    const auditService = request.services.auditService;
    const pageResult = auditService.search(searchParams);

    return {
      content: pageResult.content.map(auditLog => toAuditLogDTO(auditLog)),
      totalElements: pageResult.totalElements,
      size: pageResult.size,
      number: pageResult.number,
      totalPages: pageResult.totalPages
    };
  }

  /**
   * Retrieves the full audit history recorded for a single entity, most recent first.
   * @summary Get audit history for an entity
   * @param entityType The type of the audited entity (e.g. `south_connector`).
   * @param entityId The identifier of the audited entity.
   * @returns {Array<AuditLogDTO>} Array of audit log entries for the entity
   */
  @Get('/{entityType}/{entityId}')
  history(@Request() request: CustomExpressRequest, @Path() entityType: string, @Path() entityId: string): Array<AuditLogDTO> {
    const auditService = request.services.auditService;
    return auditService.findByEntity(entityType as AuditEntityType, entityId).map(auditLog => toAuditLogDTO(auditLog));
  }
}
