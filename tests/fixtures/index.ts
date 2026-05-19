export const fixtureNames = {
  basic: 'basic.md',
  rich: 'rich.md',
  mermaid: 'mermaid.md',
  sanitization: 'sanitization.md',
} as const;

export type FixtureName = keyof typeof fixtureNames;

export const fixtures = {
  basic: '# Basic Fixture\n\nA short markdown document for smoke tests.\n\n- One\n- Two\n- Three\n',
  rich: '# Rich Fixture\n\n## Links\n\nRead more at [Example Domain](https://example.com).\n\n## Table\n\n| Item | Value |\n| --- | --- |\n| Alpha | One |\n| Beta | Two |\n\n## Image\n\n![A simple placeholder image](https://example.com/image.png)\n',
  mermaid: '# Mermaid Fixture\n\n```mermaid\nflowchart TD\n  A[Start] --> B{Ready?}\n  B -->|Yes| C[Done]\n  B -->|No| D[Retry]\n```\n',
  sanitization: '# Sanitization Fixture\n\nThis document exercises unsafe markdown URLs.\n\n[Unsafe link](javascript:alert(\'xss\'))\n\n![Unsafe image](javascript:alert(\'xss\'))\n\n[Data URL](data:text/html,<script>alert(\'xss\')</script>)\n',
} as const;
