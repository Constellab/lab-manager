import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';

/**
 * Helper to simplify get metadata form method or class
 */
export class ReflectorHelper {
  /**
   * Get the metadata for a method
   */
  public static getMethodMetadata(reflector: Reflector, context: ExecutionContext, metadataKey: string): any {
    return reflector.get<boolean>(metadataKey, context.getHandler());
  }

  /**
   * Get the metadata for a class
   */
  public static getClassMetadata(reflector: Reflector, context: ExecutionContext, metadataKey: string): any {
    return reflector.get<boolean>(metadataKey, context.getClass());
  }

  /**
   * Get the metadata for a class and if empty, check the method
   */
  public static getClassOrMethodMetadata(
    reflector: Reflector,
    context: ExecutionContext,
    metadataKey: string
  ): any {
    return (
      ReflectorHelper.getClassMetadata(reflector, context, metadataKey) ||
      ReflectorHelper.getMethodMetadata(reflector, context, metadataKey)
    );
  }
}
