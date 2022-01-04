import {ExecutionContext, SetMetadata} from '@nestjs/common';
import {CustomDecorator} from '@nestjs/common/decorators/core/set-metadata.decorator';
import {Reflector} from '@nestjs/core';
import {ReflectorHelper} from '../helpers/reflector.helper';

const publicMetadata = 'isPublic';

/**
 * @Public decorator for method or class to make a route public so the guard
 * don't check the existence of the token
 */
export const Public = (): CustomDecorator => SetMetadata(publicMetadata, true);

/**
 * return true if the method or class is decorated with @Public
 */
export function isDecoratedWithPublic(reflector: Reflector, context: ExecutionContext): boolean {
  // Check if the route is annotated with @Public
  return ReflectorHelper.getClassOrMethodMetadata(reflector, context, publicMetadata);
}
