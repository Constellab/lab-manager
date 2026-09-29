import { getPrivateFileTemplate, PrivateFile } from '../../core/models/private-file.class';
import { getCommunityCspAllowedDomain, getCspAllowedDomains } from './env-variable.service';

describe('lab front CSP domains', () => {
  let privateJson: PrivateFile;

  beforeEach(() => {
    privateJson = getPrivateFileTemplate();
    privateJson.space.apiUrl = 'https://api.acme.org';
    privateJson.space.frontUrl = 'https://my-space.space.acme.org';
    privateJson.community.apiUrl = 'https://community-api.acme.org';
  });

  it('uses the domains sent by the Space', () => {
    privateJson.space.cspAllowedDomains = '*.space.acme.org api.acme.org';
    privateJson.community.cspAllowedDomain = 'community-api.acme.org';

    expect(getCspAllowedDomains(privateJson)).toBe('*.space.acme.org api.acme.org');
    expect(getCommunityCspAllowedDomain(privateJson)).toBe('community-api.acme.org');
  });

  it('derives them from the urls when the Space did not send them', () => {
    delete privateJson.space.cspAllowedDomains;
    delete privateJson.community.cspAllowedDomain;

    expect(getCspAllowedDomains(privateJson)).toBe('my-space.space.acme.org api.acme.org');
    expect(getCommunityCspAllowedDomain(privateJson)).toBe('community-api.acme.org');
  });

  it('keeps the port of a url', () => {
    privateJson.space.frontUrl = 'http://localhost:4200';
    privateJson.space.apiUrl = 'http://localhost:3001';

    expect(getCspAllowedDomains(privateJson)).toBe('localhost:4200 localhost:3001');
  });

  it('is empty when no url is known, so the lab front keeps its defaults', () => {
    privateJson.space.frontUrl = '';
    privateJson.space.apiUrl = 'not a url';
    privateJson.community.apiUrl = '';

    expect(getCspAllowedDomains(privateJson)).toBe('');
    expect(getCommunityCspAllowedDomain(privateJson)).toBe('');
  });
});
