import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { postRequest } from '@/network/post';

export const fetchHealthOpsWorkflowSession = (workflowSessionId: string) =>
  getRequest(ROUTES.healthOps.workflowResume(workflowSessionId), {
    errorMessage: 'Unable to load workflow session.',
  });

export const updateHealthOpsWorkflowStep = (
  workflowSessionId: string,
  options: {
    engineSessionId: string;
    stepKey: string;
    isCompleted?: boolean;
    contentPosition?: number | null;
    payload?: Record<string, any>;
  },
) =>
  patchRequest(
    ROUTES.healthOps.workflowStep(workflowSessionId),
    {
      engine_session_id: String(options.engineSessionId || '').trim(),
      step_key: String(options.stepKey || '').trim(),
      is_completed: options.isCompleted ?? true,
      ...(typeof options.contentPosition === 'number' ? { content_position: options.contentPosition } : {}),
      ...(options.payload && typeof options.payload === 'object' ? { payload: options.payload } : {}),
    },
    {
      errorMessage: 'Unable to update workflow step.',
    },
  );

export const fetchServiceEngineMappings = (serviceId: string) =>
  getRequest(ROUTES.healthOps.serviceEngineMappings(serviceId), {
    errorMessage: 'Unable to load service engines.',
  });

export const updateServiceEngineMapping = (
  serviceId: string,
  mappingId: string,
  payload: Record<string, any>,
) =>
  patchRequest(ROUTES.healthOps.serviceEngineMapping(serviceId, mappingId), payload, {
    errorMessage: 'Unable to update engine mapping.',
  });

export const reorderServiceEngineMappings = (serviceId: string, mappingIds: string[]) =>
  postRequest(
    ROUTES.healthOps.serviceEngineMappingsReorder(serviceId),
    { mapping_ids: mappingIds.map((value) => String(value || '').trim()).filter(Boolean) },
    {
      errorMessage: 'Unable to reorder engine mappings.',
    },
  );
