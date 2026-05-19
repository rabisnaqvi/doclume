# Sanitization Fixture

This document exercises unsafe markdown URLs.

[Unsafe link](javascript:alert('xss'))

![Unsafe image](javascript:alert('xss'))

[Data URL](data:text/html,<script>alert('xss')</script>)
