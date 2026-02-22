-- Allow members to reset password (forgot password flow).
-- Client hashes the new password with SHA-256 and sends the hash; this RPC only updates password_hash.

CREATE OR REPLACE FUNCTION reset_member_password(p_email text, p_password_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' OR p_password_hash IS NULL OR trim(p_password_hash) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email and password are required');
  END IF;

  UPDATE members
  SET password_hash = p_password_hash,
      updated_at   = now()
  WHERE email = trim(p_email)
    AND status = 'active';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active account found for this email');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Allow anonymous (client) to call this function for forgot-password flow
GRANT EXECUTE ON FUNCTION reset_member_password(text, text) TO anon;
GRANT EXECUTE ON FUNCTION reset_member_password(text, text) TO authenticated;
