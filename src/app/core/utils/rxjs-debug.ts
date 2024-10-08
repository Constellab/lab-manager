import {tap} from 'rxjs/operators';
import {MonoTypeOperatorFunction} from 'rxjs';

/**
 * Simple RXJS operator to debug the value emitted in a operator
 * @param tag optional tag for the observable to differentiate it
 */
export function rxjsDebug<T>(tag ?: string): MonoTypeOperatorFunction<T> {
  if (tag == null) {
    tag = '';
  } else {
    tag += ': ';
  }

  return tap({
    next(value) {
      console.log(`%c[${tag}Next]`, 'background: #009688; color: #fff; padding: 3px; font-size: 9px;', value);
    },
    error(error) {
      console.log(`%c[${tag}Error]`, 'background: #E91E63; color: #fff; padding: 3px; font-size: 9px;', error);
    },
    complete() {
      console.log(`%c[${tag}Complete]`, 'background: #00BCD4; color: #fff; padding: 3px; font-size: 9px;');
    }
  });
}
