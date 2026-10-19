import {
  loginSchema,
  resetPasswordSchema,
  signUpSchema,
  verifyEmailSchema,
} from '@/features/auth/schemas';

const validSignUp = {
  username: 'juan_dela_cruz',
  email: 'juan@example.com',
  password: 'gasolina95',
  confirmPassword: 'gasolina95',
  acceptPrivacy: true,
};

function firstError(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) {
  return result.error?.issues[0];
}

describe('signUpSchema', () => {
  it('accepts a complete, valid form', () => {
    expect(signUpSchema.safeParse(validSignUp).success).toBe(true);
  });

  it.each([
    ['too short', 'ab'],
    ['spaces', 'juan cruz'],
    ['symbols', 'juan!'],
    ['too long', 'a'.repeat(21)],
  ])('rejects a username with %s', (_label, username) => {
    const result = signUpSchema.safeParse({ ...validSignUp, username });
    expect(firstError(result)?.path).toEqual(['username']);
  });

  it('requires letters and numbers in the password (matches Supabase config)', () => {
    expect(
      firstError(
        signUpSchema.safeParse({
          ...validSignUp,
          password: 'abcdefgh',
          confirmPassword: 'abcdefgh',
        }),
      )?.message,
    ).toBe('Include at least one number.');
    expect(
      firstError(
        signUpSchema.safeParse({
          ...validSignUp,
          password: '12345678',
          confirmPassword: '12345678',
        }),
      )?.message,
    ).toBe('Include at least one letter.');
    expect(
      firstError(signUpSchema.safeParse({ ...validSignUp, password: 'a1', confirmPassword: 'a1' }))
        ?.message,
    ).toBe('Use at least 8 characters.');
  });

  it('flags mismatched passwords on the re-type field', () => {
    const result = signUpSchema.safeParse({ ...validSignUp, confirmPassword: 'different1' });
    expect(firstError(result)).toMatchObject({
      path: ['confirmPassword'],
      message: 'Passwords do not match.',
    });
  });

  it('requires privacy consent', () => {
    const result = signUpSchema.safeParse({ ...validSignUp, acceptPrivacy: false });
    expect(firstError(result)?.path).toEqual(['acceptPrivacy']);
  });

  it('rejects an invalid email', () => {
    const result = signUpSchema.safeParse({ ...validSignUp, email: 'juan@' });
    expect(firstError(result)?.message).toBe('Enter a valid email address.');
  });
});

describe('loginSchema', () => {
  it('trims the email', () => {
    const result = loginSchema.parse({
      email: '  juan@example.com ',
      password: 'x',
      stayLoggedIn: true,
    });
    expect(result.email).toBe('juan@example.com');
  });

  it('asks for an email before validating its format', () => {
    const result = loginSchema.safeParse({ email: '', password: 'x', stayLoggedIn: true });
    expect(firstError(result)?.message).toBe('Enter your email address.');
  });
});

describe('codes', () => {
  it.each(['123456', ' 654321 '])('accepts %p', (code) => {
    expect(verifyEmailSchema.safeParse({ code }).success).toBe(true);
  });

  it.each(['12345', '1234567', 'abcdef'])('rejects %p', (code) => {
    expect(verifyEmailSchema.safeParse({ code }).success).toBe(false);
  });

  it('checks the new password matches when resetting', () => {
    const result = resetPasswordSchema.safeParse({
      code: '123456',
      password: 'newpass123',
      confirmPassword: 'newpass124',
    });
    expect(firstError(result)?.path).toEqual(['confirmPassword']);
  });
});
