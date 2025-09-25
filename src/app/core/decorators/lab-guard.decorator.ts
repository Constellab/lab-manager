import { ExecutionContext, SetMetadata } from '@nestjs/common';
import { CustomDecorator } from '@nestjs/common/decorators/core/set-metadata.decorator';
import { Reflector } from '@nestjs/core';
import { ReflectorHelper } from '../helpers/reflector.helper';

const labGuardMetadata = 'labGuard';

/**
 * @Public decorator for method or class to make a route public so the guard
 * don't check the existence of the token
 */
export const LabGuard = (): CustomDecorator => SetMetadata(labGuardMetadata, true);

/**
 * return true if the method or class is decorated with @LabGuard
 */
export function isDecoratedWithLabGuard(reflector: Reflector, context: ExecutionContext): boolean {
  // Check if the route is annotated with @LabGuard
  return ReflectorHelper.getClassOrMethodMetadata(reflector, context, labGuardMetadata);
}
